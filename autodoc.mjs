import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { fromXml } from "xast-util-from-xml";
import { selectAll } from "unist-util-select";

function buildAutosummaryRST(node) {
  const bodyArgs = [];
  for (const arg of [
    "members",
    "undoc-members",
    "special-members",
    "private-members",
  ]) {
    if (node[arg] !== undefined) {
      bodyArgs.push(`   :${arg}: ${node[arg]}`);
    }
  }
  const body = bodyArgs.join("\n");
  return `
.. automodule:: ${node.module}
${body}
`;
}

/**
 * Interpret the parsed result of :foo: as an empty string, rather than "true"
 */
function coerceString(value) {
  switch (value) {
    case "true":
      return "";
    default:
      return value;
  }
}

/**
 * Prepare Sphinx and run a build
 * @param opts transform options
 */
function autodocTransformImpl(opts, utils) {
  return async (mdast) => {
    // TODO handle options
    const automoduleNodes = utils.selectAll("sphinx-automodule", mdast);
    const generatedDirectives = automoduleNodes.map(buildAutosummaryRST);
    if (!automoduleNodes.length) {
      return;
    }

    // Spit out index.rst
    await fs.writeFile("sphinx/index.rst", generatedDirectives.join("\n"));

    // Run Sphinx build
    const subprocess = spawn("sphinx-build", [
      "-b",
      "xml",
      "sphinx",
      "sphinx/xml",
    ]);
    await new Promise((resolve) => {
      subprocess.on("close", resolve);
    });

    // Parse the resulting XML
    const tree = fromXml(await fs.readFile("sphinx/xml/index.xml"));

    // The actual data follows the target. We want something like target + text + desc as a selector, but I don't know how robust that is.
    const descNodes = selectAll("element[name=desc]", tree);

    // Group `desc` nodes by module
    const moduleToDesc = new Map();
    descNodes.forEach((node) => {
      // Parse `module-XXX` ID as `XXX`
      const refID = node.attributes?.ids ?? ""; // TODO: is this plural, i.e separated somehow? Assume not.
      const [_, module] = refID.match(/module-(.*)/);

      // Append desc node to those grouped by module
      if (moduleToDesc.has(module)) {
        moduleToDesc.get(module).push(node);
      } else {
        moduleToDesc.set(module, [node]);
      }
    });

    // Now process each node
    automoduleNodes.forEach((node) => {
      const moduleDescNodes = moduleToDesc.get(node.module);
      processModule(node, moduleDescNodes);
    });
  };
}

function interleave(items, spacer) {
  return items
    .map((item) => [item, spacer])
    .reduce((result, array) => result.concat(array))
    .slice(0, -1);
}
function translateDescNode(node) {
  if (node.type !== "element") {
    return node;
  }
  switch (node.name) {
    case "desc":
	  case "desc_signature":
      return {
        type: "div",
        children: node.children.map(translateDescNode)
      };
    case "desc_parameterlist":
      return {
        type: "span",
        children: [
          { type: "text", value: "(" },
          ...interleave(node.children.map(translateDescNode), {
            type: "text",
            value: ", ",
          }),
          { type: "text", value: ")" },
        ],
      };
    case "desc_parameter":
      return { type: "span", children: node.children.map(translateDescNode) };
    case "desc_addname":
    case "desc_sig_space":
    case "desc_sig_punctuation":
    case "desc_sig_operator":
      return node.children.map(translateDescNode)[0];
    case "desc_name":
      return {
        type: "strong",
        children: node.children.map(translateDescNode),
      };
    case "desc_sig_name":
      return {
        type: "emphasis",
        children: node.children.map(translateDescNode),
      };
    case "field_list":
      return {
        type: "field_list",
        children: node.children.map(translateDescNode),
      };
    case "field_name":
      return {
        type: "span",
        children: [
          { type: "emphasis", children: node.children.map(translateDescNode) },
        ],
      };

    default:
      return { type: "span", children: node.children.map(translateDescNode) };
  }
}

function processModule(node, descNodes) {
  console.log(node.module, JSON.stringify(descNodes, null, 2));
  node.children = descNodes.map(translateDescNode);
}

const automoduleDirective = {
  name: "automodule",
  doc: "Sphinx automodule connection.",
  arg: { type: String, doc: "The Python module name" },
  options: {
    members: { type: String },
    "undoc-members": { type: String },
    "private-members": { type: String },
    "special-members": { type: String },
  },
  run(data) {
    const node = {
      type: "sphinx-automodule",
      module: data.arg,

      members: coerceString(data.options?.members),
      "undoc-members": coerceString(data.options?.["undoc-members"]),
      "private-members": coerceString(data.options?.["private-members"]),
      "special-members": coerceString(data.options?.["special-members"]),

      children: [],
    };
    return [node];
  },
};
const autodocTransform = {
  plugin: autodocTransformImpl,
  stage: "document",
};

const plugin = {
  name: "Sphinx autodoc",
  directives: [automoduleDirective],
  transforms: [autodocTransform],
};

export default plugin;

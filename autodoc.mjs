import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { fromXml } from "xast-util-from-xml";


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

function coerceString(value) {
  switch (value) {
    case "true":
      return "";
    default:
      return value;
  }
}

/**
 * Call out to an external process that conforms to a JSON-based
 * stdin-stdout transform specification.
 *
 * @param opts transform options, containing the binary path and arguments
 */
function autodocTransformImpl(opts, utils) {
  return async (mdast) => {
    // TODO handle options
    const automoduleNodes = utils.selectAll("sphinx-automodule", mdast);
    const generatedDirectives = automoduleNodes.map(buildAutosummaryRST);

    await fs.writeFile("sphinx/index.rst", generatedDirectives.join("\n"));

    const subprocess = spawn("sphinx-build", ["-b", "xml", "sphinx", "sphinx/xml"]);	
await new Promise((resolve) => {
      subprocess.on('close', resolve);
    });
    const tree = fromXml(await fs.readFile("sphinx/xml/index.xml")) ;
    console.log(JSON.stringify(tree, null, 2))
  };
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

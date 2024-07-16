from sphinx.builders import Builder
import urllib.parse
import json
import os.path
import pathlib
from docutils.nodes import NodeVisitor
from weakref import WeakKeyDictionary
import inspect


class MySTBuilder(Builder):
    name = "myst"

    def slugify(self, path):
        return urllib.parse.quote_plus(path)

    def _get_target_path(self, doc_name):
        target_stem = self.slugify(doc_name)
        return os.path.join(self.outdir, f"{target_stem}.json")

    def _get_outdated_docs(self):
        for docname in self.env.found_docs:
            if docname not in self.env.all_docs:
                yield docname
                continue
            target_path = self._get_target_path(docname)
            try:
                targetmtime = os.path.getmtime(target_path)
            except Exception:
                targetmtime = 0
            try:
                srcmtime = os.path.getmtime(self.env.doc2path(docname))
                if srcmtime > targetmtime:
                    yield docname
            except OSError:
                # source doesn't exist anymore
                pass

    def get_outdated_docs(self):
        it = self._get_outdated_docs()

        for item in it:
            yield item
            break
        else:
            return

        yield from it
        yield os.path.join(self.outdir, "myst.xref.json")

    def prepare_writing(self, docnames):
        print(f"About to write {docnames}")

    def write_doc(self, docname, doctree):
        slug = self.slugify(docname)
        path = self._get_target_path(docname)
        visitor = MySTNodeVisitor(doctree)
        doctree.walkabout(visitor)

        dst = pathlib.Path(path)
        dst.parent.mkdir(exist_ok=True)

        mdast = {
            "kind": "Article",
            "sha256": "b850f57aef34030a6dc6268eacd01101dff4aa860785234c2fbb83cafa66805d",
            "slug": slug,
            "location": f"/{docname}",
            "dependencies": [],
            "frontmatter": {},
            "mdast": visitor.result,
            "references": {"cite": {"order": [], "data": {}}},
        }

        with open(dst, "w") as f:
            json.dump(mdast, f)

    # xref impl is done at build time ... we need to embed and then use non-xref links to refer to _that_ AST

    def finish(self):
        references = [
            {"kind": "page", "url": f"/{slug}", "data": f"/{slug}.json"}
            for slug in (self.slugify(n) for n in self.env.found_docs)
        ]
        xref = {"version": "1", "myst": "1.2.9", "references": references}
        with open(os.path.join(self.outdir, "myst.xref.json"), "w") as f:
            json.dump(xref, f)

    def get_target_uri(self, docname, typ=None):
        return self.slugify(docname)


class MySTNodeVisitor(NodeVisitor):

    def __init__(self, document):
        super().__init__(document)

        self._stack = []
        self._result_stack = []

        self._sibling_actions = WeakKeyDictionary()
        self._visited = WeakKeyDictionary()

        self._heading_depth = 0
        self._result = None

    def dispatch_visit(self, node):
        visitor_name = f"visit_{node.__class__.__name__}"
        impl = getattr(self, visitor_name)

        # Invoke visitor
        gen_or_result = impl(node)
        if inspect.isgenerator(gen_or_result):
            result = next(gen_or_result)
        else:
            result = gen_or_result

        # Allow follow up actions
        try:
            sibling_action = self._sibling_actions[node]
        except KeyError:
            pass
        else:
            # Remove action once finished
            if sibling_action(node, result):
                del self._sibling_actions[node]

        self._stack.append(node)

        if result is not None:
            if self._result_stack:
                parent_result = self._result_stack[-1]
                parent_result['children'].append(result)
            self._result_stack.append(result)


        self._visited[node] = gen_or_result, result

    def dispatch_departure(self, node):
        try:
            maybe_gen, maybe_result = self._visited.pop(node)
        except KeyError:
            return

        # Exit result generator
        if inspect.isgenerator(maybe_gen):
            next(maybe_gen, None)

        # Eixt stack for this result if created
        if maybe_result is not None:
            self._result_stack.pop()

        self._stack.pop()

    @property
    def parent_node(self):
        return self._stack[-1] if self._stack else None

    @property
    def parent_result_node(self):
        return self._result_stack[-1] if self._result_stack else None

    @property 
    def result(self):
        return self._result

    def set_sibling_action(self, action):
        self._sibling_actions[self.parent_node] = action

    def visit_inline(self, node):
        return {"type": "span", "class": node.get("classes"), "children": []}

    def visit_reference(self, node):
        assert node["internal"]

        return {"type": "link", "url": f"#{node['refid']}", "children": []}

    def visit_target(self, node):
        
        def action(_, result_node):
            result_node["id"] = node["refid"]
            return True # Did apply to target

        self.set_sibling_action(action)

    def visit_title(self, node): 
        self._heading_depth += 1
        yield {"type": "heading", "depth": self._heading_depth, "children": []}
        self._heading_depth -= 1

    def visit_paragraph(self, node):
        return {"type": "paragraph", "children": []}

    def visit_Text(self, node):
        return {"type": "text", "value": str(node)}


    # visit_XXX admonitions (see loop below)

    def visit_section(self, node):
        return {"type": "block", "children": []}

    def visit_document(self, node):
        result = {"type": "root", "children": []}
        yield result

        self._result = result


for name in ("attention", "caution", "danger", "error", "hint", "important", "note", "tip", "warning"):
    def visitor(self, node):
        return {"type": "admonition", "kind": name, "children": []}
    setattr(MySTNodeVisitor, f"visit_{name}", visitor)


def setup(app):
    app.add_builder(MySTBuilder)

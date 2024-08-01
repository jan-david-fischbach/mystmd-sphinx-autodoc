import sys
import os

sys.path.insert(0, os.getcwd())
extensions = ["sphinx_ext_mystmd", "sphinx.ext.autodoc", "sphinx.ext.napoleon"]
exclude_patterns = [".*", "_build"]
numfig = True

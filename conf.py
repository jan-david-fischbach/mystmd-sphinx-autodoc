import sys
import os

sys.path.insert(0, os.getcwd())
extensions = [
#    "autodoc2",
    "mystmd"
]
autodoc2_packages = [
    "./randomz",
]
exclude_patterns = [".*", "_build"]

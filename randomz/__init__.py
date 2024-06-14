__all__ = ["random_letters"]

import random
import time
import string


def random_letters(seed: int=None, n:int=100):
    """Returns a list of random characters.

    :param seed: An RNG seed
    :type seed: int, optional
    :param n: Number of random values
    :type n: int, optional
    :return: A list of random characters
    :rtype: list
    """
    random.seed(time.time() if seed is None else seed)
    return [random.choice(string.ascii_letters) for i in range(n)]

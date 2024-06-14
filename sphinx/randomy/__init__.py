__all__ = ["random_numbers"]

import random
import time


def random_numbers(seed: int=None, n:int=100):
    """Returns a list of random numbers.

    :param seed: An RNG seed
    :type seed: int, optional
    :param n: Number of random values
    :type n: int, optional
    :return: A list of random numbers
    :rtype: list
    """
    random.seed(time.time() if seed is None else seed)
    return [random.random() for i in range(n)]

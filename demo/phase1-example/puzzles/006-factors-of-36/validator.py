def check(entry):
    """One submitted factor. True when it divides 36 exactly."""
    # Out of range or not an integer raises, which marks just this entry
    # invalid and says why -- the rest of the list is still scored.
    value = entry.int(1, 36)
    entry.eof()          # "12 18" on one line is two answers, not one
    return 36 % value == 0

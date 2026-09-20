"""The write side of the risk service.

There is none, deliberately. Risk analysis reads accepted stakes and reports
an action; it never alters a bet, a price or a result. Having no command side
is what makes that a property of the wiring rather than a promise in a
document — there is no handler through which risk could change anything.
"""

"""Every router the app serves, in the order they are registered.

Order matters where a static path could be read as a parameter: the Phase 1
selection routes (/api/admin/phase1/advance) come before the authoring routes
(/api/admin/phase1/{section}).
"""

from fastapi import APIRouter

from .admin import auction as admin_auction
from .admin import contest as admin_contest
from .admin import judge as admin_judge
from .admin import people as admin_people
from .admin import phase1_authoring as admin_phase1_authoring
from .admin import phase1_selection as admin_phase1_selection
from .admin import powerups as admin_powerups
from .admin import problems as admin_problems
from .admin import questions as admin_questions
from .admin import setup as admin_setup
from .participant import coding, marketplace, phase1, session
from .staff import grading

ROUTERS: list[APIRouter] = [
    session.router,
    coding.router,
    marketplace.router,
    phase1.router,
    grading.router,
    admin_contest.router,
    admin_setup.router,
    admin_auction.router,
    admin_questions.router,
    admin_powerups.router,
    admin_people.router,
    admin_phase1_selection.router,
    admin_phase1_authoring.router,
    admin_problems.router,
    admin_judge.router,
]

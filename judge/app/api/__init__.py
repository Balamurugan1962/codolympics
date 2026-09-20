"""The HTTP layer. Implements openapi.yaml exactly.

Routes do three things and nothing else: check the request, call into the
services, shape the response. All the judging logic lives elsewhere.
"""

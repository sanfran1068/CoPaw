# -*- coding: utf-8 -*-
"""
QwenPaw Chat sidebar & multi-tab end-to-end tests (Sprint 4).

Cases:
- SIDEBAR-001  P1  test_sidebar_date_groups_and_collapse   (upstream #5643)
- MULTITAB-001 P0  test_sdk_queue_has_single_cross_tab_owner

SIDEBAR-001 mocks ``GET /api/chats?archived=false`` via page.route because
the backend cannot backfill timestamps (patch forces "now"), so date
buckets are otherwise impossible to construct. All assertions stay UI-side.

MULTITAB-001 uses two real pages in the SAME browser context. A forced
``running`` status keeps one input queued so the SDK's Web Locks and
BroadcastChannel behavior can be asserted without sending to a real model.
"""
from __future__ import annotations

import logging

import pytest
from playwright.sync_api import expect

from pages.chat_page import ChatPage
from mocks import sidebar_sessions
from config.settings import config
from utils.helpers import log_test_step, log_test_result


logger = logging.getLogger(__name__)


# ============================================================================
# SIDEBAR-001 P1 — sidebar session date grouping (upstream #5643)
# ============================================================================

@pytest.mark.integration
@pytest.mark.p1
@pytest.mark.chat_sidebar
class TestSidebarDateGroups:
    """Sidebar buckets: Pinned/Today/7d/30d/Earlier + collapse toggling."""

    @pytest.mark.test_id("SIDEBAR-001")
    def test_sidebar_date_groups_and_collapse(
        self,
        page,
        request: pytest.FixtureRequest,
    ) -> None:
        """Upstream re-architected the sidebar into user groups that each
        contain date buckets (pinned / today / week / month / older).
        Date headers are non-collapsible; the user-group header toggles
        the whole bucket. This case verifies:

        1. The default group header renders
        2. Date headers for the crafted sessions render (pinned/today/week)
        3. Expanded group shows its sessions
        4. Collapsing the group hides its sessions
        5. Expanding again restores them
        """
        test_name = request.node.name

        log_test_step("1. Mock the sidebar list with 5 crafted-timestamp sessions")
        sidebar_sessions.register(page)
        # SidebarSessionList only mounts in the sidebar's *simple* mode
        # (Sidebar.tsx: isSimpleExpanded branch); the default is "full"
        # nav mode, so pin simple mode before the app boots.
        page.add_init_script(
            "try { localStorage.setItem('qwenpaw_sidebar_mode', 'simple'); }"
            " catch (e) {}"
        )
        chat = ChatPage(page)
        chat.open()

        log_test_step("2. Date headers render for the crafted buckets")
        for group in ("pinned", "today", "week"):
            expect(chat.get_sidebar_group_header(group)).to_be_visible(
                timeout=chat.timeout
            )

        log_test_step("3. Expanded group shows its sessions")
        expect(
            chat.get_sidebar_session_by_name(sidebar_sessions.PINNED_NAME)
        ).to_be_visible(timeout=chat.timeout)
        expect(
            chat.get_sidebar_session_by_name(sidebar_sessions.TODAY_NAME)
        ).to_be_visible(timeout=chat.timeout)
        expect(
            chat.get_sidebar_session_by_name(sidebar_sessions.WEEK_NAME)
        ).to_be_visible(timeout=chat.timeout)

        log_test_step("4. Collapsing the user group hides its sessions")
        chat.toggle_sidebar_user_group()
        expect(
            chat.get_sidebar_session_by_name(sidebar_sessions.TODAY_NAME)
        ).not_to_be_visible(timeout=5000)

        log_test_step("5. Expanding again restores them")
        chat.toggle_sidebar_user_group()
        expect(
            chat.get_sidebar_session_by_name(sidebar_sessions.TODAY_NAME)
        ).to_be_visible(timeout=chat.timeout)

        log_test_result(test_name, True, 0)
        logger.info(f"Test {test_name} passed")


# ============================================================================
# MULTITAB-001 P0 — SDK queue single-owner arbitration
# ============================================================================

@pytest.mark.integration
@pytest.mark.p0
@pytest.mark.chat_sidebar
class TestMultiTabQueueBanner:
    """SDK queue state is shared and exactly one tab owns execution."""

    @pytest.mark.test_id("MULTITAB-001")
    def test_sdk_queue_has_single_cross_tab_owner(
        self,
        page,
        api_context,
        request: pytest.FixtureRequest,
    ) -> None:
        test_name = request.node.name

        log_test_step("1. Seed a chat via API so both tabs share one session id")
        seed = api_context.post(
            "/api/chats",
            data={
                "name": "E2E MultiTab Banner",
                "user_id": config.test.user_id,
                "channel": config.test.channel,
                "session_id": f"{config.test.channel}:{config.test.user_id}",
            },
        )
        if not seed.ok:
            pytest.skip(f"chat seed failed ({seed.status}); cannot test banner")
        chat_id = (seed.json() or {}).get("id")
        if not chat_id:
            pytest.skip("chat seed returned no id; cannot test banner")

        session_url = f"{config.base_url}/chat/{chat_id}"
        browser_context = page.context
        page2 = None

        def force_running(route):
            response = route.fetch()
            payload = response.json()
            payload["status"] = "running"
            route.fulfill(response=response, json=payload)

        browser_context.route(f"**/api/chats/{chat_id}", force_running)
        try:
            log_test_step("2. Both tabs open the same SDK queue scope")
            chat1 = ChatPage(page)
            page.goto(session_url, wait_until="commit", timeout=chat1.timeout)
            expect(page.locator(chat1.CHAT_INPUT).first).to_be_visible(
                timeout=chat1.timeout
            )
            page2 = browser_context.new_page()
            chat2 = ChatPage(page2)
            page2.goto(session_url, wait_until="commit", timeout=chat2.timeout)
            expect(page2.locator(chat2.CHAT_INPUT).first).to_be_visible(
                timeout=chat2.timeout
            )

            log_test_step("3. Submit while backend reports running; SDK queues it")
            queued_text = "sdk queue cross-tab ownership"
            input2 = page2.locator(chat2.CHAT_INPUT).first
            input2.fill(queued_text)
            input2.press("Enter")

            log_test_step("4. Queue item is synchronized to both tabs")
            expect(chat1.get_queue_panel()).to_be_visible(timeout=15000)
            expect(chat2.get_queue_panel()).to_be_visible(timeout=15000)
            expect(
                chat1.get_queue_items().filter(has_text=queued_text)
            ).to_have_count(1)
            expect(
                chat2.get_queue_items().filter(has_text=queued_text)
            ).to_have_count(1)

            log_test_step("5. Exactly one tab is marked as the remote/non-owner view")
            page.wait_for_timeout(1200)
            remote1 = chat1.get_queue_remote_owner().count() > 0
            remote2 = chat2.get_queue_remote_owner().count() > 0
            assert remote1 != remote2, (
                f"expected one remote owner marker, got tab1={remote1}, tab2={remote2}"
            )

            log_test_step("6. Closing owner transfers queue execution ownership")
            if remote1:
                page2.close()
                page2 = None
                expect(chat1.get_queue_remote_owner()).not_to_be_visible(timeout=15000)
            else:
                page.close()
                expect(chat2.get_queue_remote_owner()).not_to_be_visible(timeout=15000)
        finally:
            if page2 is not None:
                try:
                    page2.close()
                except Exception:
                    pass
            try:
                browser_context.unroute(f"**/api/chats/{chat_id}", force_running)
            except Exception:
                pass
            try:
                api_context.delete(f"/api/chats/{chat_id}")
            except Exception:
                pass

        log_test_result(test_name, True, 0)
        logger.info(f"Test {test_name} passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

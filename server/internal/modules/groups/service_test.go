package groups

import "testing"

func TestHistoryModeConstants(t *testing.T) {
	if HistoryFull != "full" || HistoryViewOnly != "view-only" {
		t.Fatal("unexpected history mode constants")
	}
}

func TestRoles(t *testing.T) {
	if RoleAdmin != "admin" || RoleMember != "member" {
		t.Fatal("unexpected roles")
	}
}

from datetime import UTC, datetime

from app.core.security import hash_password
from app.models import User


def _make_user(db_session, username, admin=False):
    now = datetime.now(UTC)
    user = User(
        username=username,
        firstname=username.title(),
        lastname="Test",
        password=hash_password("correct-password"),
        admin=admin,
        status="active",
        createdAt=now,
        updatedAt=now,
    )
    db_session.add(user)
    db_session.commit()
    return user


def _auth_headers(client, username):
    login = client.post("/api/auth/login", json={"username": username, "password": "correct-password"})
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_create_home_requires_admin(client, db_session):
    member = _make_user(db_session, "member1", admin=False)
    headers = _auth_headers(client, "member1")

    response = client.post("/api/homes", json={"name": "Casa", "owner_user_id": member.id}, headers=headers)
    assert response.status_code == 403


def test_create_home_with_missing_owner_404s(auth_client, test_user):
    response = auth_client.post("/api/homes", json={"name": "Casa", "owner_user_id": 999999})
    assert response.status_code == 404


def test_admin_creates_home_and_owner_becomes_member(auth_client, db_session, test_user):
    owner = _make_user(db_session, "owner1")

    created = auth_client.post("/api/homes", json={"name": "Casa", "owner_user_id": owner.id})
    assert created.status_code == 201
    body = created.json()
    assert body["name"] == "Casa"
    assert body["member_count"] == 1


def test_get_homes_admin_sees_all_member_sees_own(auth_client, db_session, test_user):
    owner = _make_user(db_session, "owner2")
    _make_user(db_session, "outsider")

    home = auth_client.post("/api/homes", json={"name": "Casa", "owner_user_id": owner.id}).json()

    admin_view = auth_client.get("/api/homes").json()
    assert any(h["id"] == home["id"] for h in admin_view)

    outsider_headers = _auth_headers(auth_client, "outsider")
    outsider_view = auth_client.get("/api/homes", headers=outsider_headers).json()
    assert not any(h["id"] == home["id"] for h in outsider_view)

    owner_headers = _auth_headers(auth_client, "owner2")
    owner_view = auth_client.get("/api/homes", headers=owner_headers).json()
    assert any(h["id"] == home["id"] for h in owner_view)


def test_get_home_requires_membership(auth_client, db_session, test_user):
    owner = _make_user(db_session, "owner3")
    _make_user(db_session, "outsider2")
    home = auth_client.post("/api/homes", json={"name": "Casa", "owner_user_id": owner.id}).json()

    outsider_headers = _auth_headers(auth_client, "outsider2")
    response = auth_client.get(f"/api/homes/{home['id']}", headers=outsider_headers)
    assert response.status_code == 403


def test_get_missing_home_404s(auth_client):
    response = auth_client.get("/api/homes/999999")
    assert response.status_code == 404


def test_update_home_requires_manager(auth_client, db_session, test_user):
    owner = _make_user(db_session, "owner4")
    home = auth_client.post("/api/homes", json={"name": "Casa", "owner_user_id": owner.id}).json()

    owner_headers = _auth_headers(auth_client, "owner4")
    response = auth_client.put(f"/api/homes/{home['id']}", json={"name": "Casa Nova"}, headers=owner_headers)
    assert response.status_code == 200

    _make_user(db_session, "outsider3")
    outsider_headers = _auth_headers(auth_client, "outsider3")
    forbidden = auth_client.put(f"/api/homes/{home['id']}", json={"name": "Nope"}, headers=outsider_headers)
    assert forbidden.status_code == 403


def test_delete_home_owner_or_admin_allowed_others_forbidden(auth_client, db_session, test_user):
    owner = _make_user(db_session, "owner5")
    home = auth_client.post("/api/homes", json={"name": "Casa", "owner_user_id": owner.id}).json()

    _make_user(db_session, "outsider5")
    outsider_headers = _auth_headers(auth_client, "outsider5")
    forbidden = auth_client.delete(f"/api/homes/{home['id']}", headers=outsider_headers)
    assert forbidden.status_code == 403

    owner_headers = _auth_headers(auth_client, "owner5")
    allowed = auth_client.delete(f"/api/homes/{home['id']}", headers=owner_headers)
    assert allowed.status_code == 200

    second_owner = _make_user(db_session, "owner5b")
    second_home = auth_client.post("/api/homes", json={"name": "Casa2", "owner_user_id": second_owner.id}).json()
    admin_delete = auth_client.delete(f"/api/homes/{second_home['id']}")
    assert admin_delete.status_code == 200


def test_transfer_ownership(auth_client, db_session, test_user):
    owner = _make_user(db_session, "owner6")
    new_owner = _make_user(db_session, "newowner")
    home = auth_client.post("/api/homes", json={"name": "Casa", "owner_user_id": owner.id}).json()

    already = auth_client.put(f"/api/homes/{home['id']}/owner", json={"user_id": owner.id})
    assert already.status_code == 409

    response = auth_client.put(f"/api/homes/{home['id']}/owner", json={"user_id": new_owner.id})
    assert response.status_code == 200


def test_add_home_member_and_duplicate_conflict(auth_client, db_session, test_user):
    owner = _make_user(db_session, "owner7")
    new_member = _make_user(db_session, "newmember")
    home = auth_client.post("/api/homes", json={"name": "Casa", "owner_user_id": owner.id}).json()

    added = auth_client.post(f"/api/homes/{home['id']}/members", json={"user_id": new_member.id})
    assert added.status_code == 201
    assert added.json()["member_count"] == 2

    duplicate = auth_client.post(f"/api/homes/{home['id']}/members", json={"user_id": new_member.id})
    assert duplicate.status_code == 409


def test_owner_role_cannot_be_changed_via_role_update(auth_client, db_session, test_user):
    owner = _make_user(db_session, "owner8")
    home = auth_client.post("/api/homes", json={"name": "Casa", "owner_user_id": owner.id}).json()

    response = auth_client.put(f"/api/homes/{home['id']}/members/{owner.id}", json={"role": "member"})
    assert response.status_code == 409


def test_admin_can_remove_owner_and_co_owner_is_promoted(auth_client, db_session, test_user):
    owner = _make_user(db_session, "owner9")
    co_owner = _make_user(db_session, "coowner9")
    home = auth_client.post("/api/homes", json={"name": "Casa", "owner_user_id": owner.id}).json()
    auth_client.post(f"/api/homes/{home['id']}/members", json={"user_id": co_owner.id, "role": "co_owner"})

    response = auth_client.delete(f"/api/homes/{home['id']}/members/{owner.id}")
    assert response.status_code == 200

    detail = auth_client.get(f"/api/homes/{home['id']}").json()
    promoted = next(m for m in detail["members"] if m["user"]["id"] == co_owner.id)
    assert promoted["role"] == "owner"
    assert not any(m["user"]["id"] == owner.id for m in detail["members"])


def test_owner_removal_promotes_any_member_when_no_co_owner(auth_client, db_session, test_user):
    owner = _make_user(db_session, "owner9b")
    plain_member = _make_user(db_session, "plainmember9b")
    home = auth_client.post("/api/homes", json={"name": "Casa", "owner_user_id": owner.id}).json()
    auth_client.post(f"/api/homes/{home['id']}/members", json={"user_id": plain_member.id})

    response = auth_client.delete(f"/api/homes/{home['id']}/members/{owner.id}")
    assert response.status_code == 200

    detail = auth_client.get(f"/api/homes/{home['id']}").json()
    promoted = next(m for m in detail["members"] if m["user"]["id"] == plain_member.id)
    assert promoted["role"] == "owner"


def test_co_owner_cannot_remove_owner(auth_client, db_session, test_user):
    owner = _make_user(db_session, "owner9c")
    co_owner = _make_user(db_session, "coowner9c")
    home = auth_client.post("/api/homes", json={"name": "Casa", "owner_user_id": owner.id}).json()
    auth_client.post(f"/api/homes/{home['id']}/members", json={"user_id": co_owner.id, "role": "co_owner"})

    co_owner_headers = _auth_headers(auth_client, "coowner9c")
    response = auth_client.delete(f"/api/homes/{home['id']}/members/{owner.id}", headers=co_owner_headers)
    assert response.status_code == 403


def test_owner_can_remove_self_and_last_member_leaves_home_empty(auth_client, db_session, test_user):
    owner = _make_user(db_session, "owner9d")
    home = auth_client.post("/api/homes", json={"name": "Casa", "owner_user_id": owner.id}).json()

    owner_headers = _auth_headers(auth_client, "owner9d")
    response = auth_client.delete(f"/api/homes/{home['id']}/members/{owner.id}", headers=owner_headers)
    assert response.status_code == 200

    detail = auth_client.get(f"/api/homes/{home['id']}").json()
    assert detail["members"] == []


def test_member_can_remove_self(auth_client, db_session, test_user):
    owner = _make_user(db_session, "owner10")
    plain_member = _make_user(db_session, "plainmember")
    home = auth_client.post("/api/homes", json={"name": "Casa", "owner_user_id": owner.id}).json()
    auth_client.post(f"/api/homes/{home['id']}/members", json={"user_id": plain_member.id})

    member_headers = _auth_headers(auth_client, "plainmember")
    response = auth_client.delete(f"/api/homes/{home['id']}/members/{plain_member.id}", headers=member_headers)
    assert response.status_code == 200


def test_transfer_ownership_requires_admin(auth_client, db_session, test_user):
    owner = _make_user(db_session, "owner11")
    new_owner = _make_user(db_session, "newowner2")
    home = auth_client.post("/api/homes", json={"name": "Casa", "owner_user_id": owner.id}).json()

    owner_headers = _auth_headers(auth_client, "owner11")
    response = auth_client.put(f"/api/homes/{home['id']}/owner", json={"user_id": new_owner.id}, headers=owner_headers)
    assert response.status_code == 403


def test_transfer_ownership_missing_target_404s(auth_client, db_session, test_user):
    owner = _make_user(db_session, "owner12")
    home = auth_client.post("/api/homes", json={"name": "Casa", "owner_user_id": owner.id}).json()

    response = auth_client.put(f"/api/homes/{home['id']}/owner", json={"user_id": 999999})
    assert response.status_code == 404


def test_add_member_missing_target_404s(auth_client, db_session, test_user):
    owner = _make_user(db_session, "owner13")
    home = auth_client.post("/api/homes", json={"name": "Casa", "owner_user_id": owner.id}).json()

    response = auth_client.post(f"/api/homes/{home['id']}/members", json={"user_id": 999999})
    assert response.status_code == 404


def test_update_member_role_missing_member_404s(auth_client, db_session, test_user):
    owner = _make_user(db_session, "owner14")
    home = auth_client.post("/api/homes", json={"name": "Casa", "owner_user_id": owner.id}).json()

    response = auth_client.put(f"/api/homes/{home['id']}/members/999999", json={"role": "member"})
    assert response.status_code == 404


def test_co_owner_cannot_change_another_co_owners_role(auth_client, db_session, test_user):
    owner = _make_user(db_session, "owner15")
    co_owner1 = _make_user(db_session, "coowner1")
    co_owner2 = _make_user(db_session, "coowner2")
    home = auth_client.post("/api/homes", json={"name": "Casa", "owner_user_id": owner.id}).json()
    auth_client.post(f"/api/homes/{home['id']}/members", json={"user_id": co_owner1.id, "role": "co_owner"})
    auth_client.post(f"/api/homes/{home['id']}/members", json={"user_id": co_owner2.id, "role": "co_owner"})

    co_owner1_headers = _auth_headers(auth_client, "coowner1")
    response = auth_client.put(
        f"/api/homes/{home['id']}/members/{co_owner2.id}", json={"role": "member"}, headers=co_owner1_headers
    )
    assert response.status_code == 403


def test_remove_member_missing_member_404s(auth_client, db_session, test_user):
    owner = _make_user(db_session, "owner16")
    home = auth_client.post("/api/homes", json={"name": "Casa", "owner_user_id": owner.id}).json()

    response = auth_client.delete(f"/api/homes/{home['id']}/members/999999")
    assert response.status_code == 404


def test_plain_member_cannot_remove_another_member(auth_client, db_session, test_user):
    owner = _make_user(db_session, "owner17")
    member1 = _make_user(db_session, "member1a")
    member2 = _make_user(db_session, "member2a")
    home = auth_client.post("/api/homes", json={"name": "Casa", "owner_user_id": owner.id}).json()
    auth_client.post(f"/api/homes/{home['id']}/members", json={"user_id": member1.id})
    auth_client.post(f"/api/homes/{home['id']}/members", json={"user_id": member2.id})

    member1_headers = _auth_headers(auth_client, "member1a")
    response = auth_client.delete(f"/api/homes/{home['id']}/members/{member2.id}", headers=member1_headers)
    assert response.status_code == 403

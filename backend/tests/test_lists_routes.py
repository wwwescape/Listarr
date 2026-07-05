from datetime import UTC, datetime

from app.core.security import hash_password
from app.models import Home, HomeMember, User


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


def test_create_and_get_list(auth_client, test_user):
    created = auth_client.post("/api/lists", json={"name": "Groceries"})
    assert created.status_code == 201
    body = created.json()
    assert body["name"] == "Groceries"

    fetched = auth_client.get(f"/api/lists/list/{body['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["name"] == "Groceries"
    assert fetched.json()["listItems"] == []


def test_list_owner_can_access_but_other_user_cannot(auth_client, db_session, test_user):
    created = auth_client.post("/api/lists", json={"name": "Groceries"}).json()

    _make_user(db_session, "other1", admin=False)
    other_headers = _auth_headers(auth_client, "other1")
    response = auth_client.get(f"/api/lists/list/{created['id']}", headers=other_headers)
    assert response.status_code == 403


def test_admin_can_access_any_list(auth_client, db_session, test_user):
    _make_user(db_session, "owner1", admin=False)
    owner_headers = _auth_headers(auth_client, "owner1")
    created = auth_client.post("/api/lists", json={"name": "Groceries"}, headers=owner_headers).json()

    # test_user (the auth_client default identity) is admin
    response = auth_client.get(f"/api/lists/list/{created['id']}")
    assert response.status_code == 200


def test_collaborator_can_access_list(auth_client, db_session, test_user):
    collaborator = _make_user(db_session, "collab1", admin=False)
    created = auth_client.post(
        "/api/lists", json={"name": "Groceries", "collaborators": [str(collaborator.id)]}
    ).json()

    collab_headers = _auth_headers(auth_client, "collab1")
    response = auth_client.get(f"/api/lists/list/{created['id']}", headers=collab_headers)
    assert response.status_code == 200


def test_get_missing_list_404s(auth_client):
    response = auth_client.get("/api/lists/list/999999")
    assert response.status_code == 404


def test_update_list_requires_access(auth_client, db_session, test_user):
    _make_user(db_session, "owner2", admin=False)
    owner_headers = _auth_headers(auth_client, "owner2")
    created = auth_client.post("/api/lists", json={"name": "Groceries"}, headers=owner_headers).json()

    _make_user(db_session, "other2", admin=False)
    other_headers = _auth_headers(auth_client, "other2")
    forbidden = auth_client.put(f"/api/lists/{created['id']}", json={"name": "Nope"}, headers=other_headers)
    assert forbidden.status_code == 403

    allowed = auth_client.put(f"/api/lists/{created['id']}", json={"name": "Weekly Groceries"}, headers=owner_headers)
    assert allowed.status_code == 200


def test_delete_list(auth_client, test_user):
    created = auth_client.post("/api/lists", json={"name": "Groceries"}).json()

    response = auth_client.delete(f"/api/lists/{created['id']}")
    assert response.status_code == 200

    missing = auth_client.get(f"/api/lists/list/{created['id']}")
    assert missing.status_code == 404


def test_list_creator_can_delete_own_list(auth_client, db_session, test_user):
    _make_user(db_session, "creator1", admin=False)
    creator_headers = _auth_headers(auth_client, "creator1")
    created = auth_client.post("/api/lists", json={"name": "Groceries"}, headers=creator_headers).json()

    response = auth_client.delete(f"/api/lists/{created['id']}", headers=creator_headers)
    assert response.status_code == 200


def test_collaborator_cannot_delete_list(auth_client, db_session, test_user):
    collaborator = _make_user(db_session, "collab2", admin=False)
    created = auth_client.post(
        "/api/lists", json={"name": "Groceries", "collaborators": [str(collaborator.id)]}
    ).json()

    collab_headers = _auth_headers(auth_client, "collab2")
    response = auth_client.delete(f"/api/lists/{created['id']}", headers=collab_headers)
    assert response.status_code == 403


def test_home_owner_can_delete_list_in_their_home(auth_client, db_session, test_user):
    now = datetime.now(UTC)
    owner = _make_user(db_session, "homeowner1", admin=False)
    home = Home(name="Casa", created_by=owner.id, createdAt=now, updatedAt=now)
    db_session.add(home)
    db_session.flush()
    db_session.add(HomeMember(home_id=home.id, user_id=owner.id, role="owner", createdAt=now))
    db_session.commit()

    # Admin creates the list and assigns it to the home; the list's creator
    # is the admin, not the home owner — deletion should still be allowed
    # for the home's owner via the home_id path, not just list.createdBy.
    created = auth_client.post("/api/lists", json={"name": "Casa List", "home_id": home.id}).json()

    owner_headers = _auth_headers(auth_client, "homeowner1")
    response = auth_client.delete(f"/api/lists/{created['id']}", headers=owner_headers)
    assert response.status_code == 200


def test_create_list_in_home_requires_manager_role(auth_client, db_session, test_user):
    now = datetime.now(UTC)
    plain_member = _make_user(db_session, "plain1", admin=False)
    home = Home(name="Casa", created_by=plain_member.id, createdAt=now, updatedAt=now)
    db_session.add(home)
    db_session.flush()
    db_session.add(HomeMember(home_id=home.id, user_id=plain_member.id, role="member", createdAt=now))
    db_session.commit()

    plain_headers = _auth_headers(auth_client, "plain1")
    forbidden = auth_client.post(
        "/api/lists", json={"name": "Casa List", "home_id": home.id}, headers=plain_headers
    )
    assert forbidden.status_code == 403

    # Admin (test_user) can place a list into any home.
    allowed = auth_client.post("/api/lists", json={"name": "Casa List", "home_id": home.id})
    assert allowed.status_code == 201


def test_duplicate_list_copies_items_unchecked(auth_client, test_user):
    created = auth_client.post("/api/lists", json={"name": "Groceries"}).json()
    auth_client.post(f"/api/lists/list/{created['id']}/items", json={"name": "Milk"})
    item2 = auth_client.post(f"/api/lists/list/{created['id']}/items", json={"name": "Eggs"}).json()
    auth_client.put(f"/api/lists/list/{created['id']}/items/{item2['id']}", json={"checked": True})

    duplicated = auth_client.post(f"/api/lists/{created['id']}/duplicate")
    assert duplicated.status_code == 201
    dup_body = duplicated.json()
    assert dup_body["name"] == "Groceries (copy)"

    dup_detail = auth_client.get(f"/api/lists/list/{dup_body['id']}").json()
    assert len(dup_detail["listItems"]) == 2
    assert all(not item["checked"] for item in dup_detail["listItems"])


def test_get_collaborators_excludes_self(auth_client, db_session, test_user):
    _make_user(db_session, "someoneelse", admin=False)

    response = auth_client.get("/api/lists/collaborators")
    assert response.status_code == 200
    usernames = [u["username"] for u in response.json()]
    assert "someoneelse" in usernames
    assert test_user.username not in usernames


def test_add_item_requires_name(auth_client, test_user):
    created = auth_client.post("/api/lists", json={"name": "Groceries"}).json()

    response = auth_client.post(f"/api/lists/list/{created['id']}/items", json={"name": "   "})
    assert response.status_code == 400


def test_add_update_delete_item(auth_client, test_user):
    created = auth_client.post("/api/lists", json={"name": "Groceries"}).json()

    added = auth_client.post(f"/api/lists/list/{created['id']}/items", json={"name": "  Bananas  "})
    assert added.status_code == 201
    item = added.json()
    assert item["name"] == "Bananas"
    assert item["checked"] is False

    updated = auth_client.put(
        f"/api/lists/list/{created['id']}/items/{item['id']}", json={"checked": True, "quantity": 3}
    )
    assert updated.status_code == 200
    updated_body = updated.json()
    assert updated_body["checked"] is True
    assert updated_body["checked_at"] is not None
    assert updated_body["quantity"] == 3

    deleted = auth_client.delete(f"/api/lists/list/{created['id']}/items/{item['id']}")
    assert deleted.status_code == 200
    assert deleted.json()["item_id"] == item["id"]


def test_update_missing_item_404s(auth_client, test_user):
    created = auth_client.post("/api/lists", json={"name": "Groceries"}).json()
    response = auth_client.put(f"/api/lists/list/{created['id']}/items/999999", json={"checked": True})
    assert response.status_code == 404


def test_delete_missing_item_404s(auth_client, test_user):
    created = auth_client.post("/api/lists", json={"name": "Groceries"}).json()
    response = auth_client.delete(f"/api/lists/list/{created['id']}/items/999999")
    assert response.status_code == 404

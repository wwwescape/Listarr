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


def test_users_exists_reflects_whether_an_admin_has_been_created(client):
    before = client.get("/api/users/exists")
    assert before.status_code == 200
    assert before.json()["admin_exists"] is False

    client.post("/api/users", json={"username": "first", "firstname": "First", "lastname": "User", "password": "pw"})

    after = client.get("/api/users/exists")
    assert after.json()["admin_exists"] is True


def test_create_first_user_becomes_admin(client):
    created = client.post(
        "/api/users", json={"username": "first", "firstname": "First", "lastname": "User", "password": "pw"}
    )
    assert created.status_code == 201
    body = created.json()
    assert body["admin"] is True
    assert "password" not in body


def test_create_second_user_requires_admin_auth(client):
    client.post("/api/users", json={"username": "first", "firstname": "F", "lastname": "L", "password": "pw"})

    unauthorized = client.post(
        "/api/users", json={"username": "second", "firstname": "Second", "lastname": "User", "password": "pw"}
    )
    assert unauthorized.status_code == 403

    login = client.post("/api/auth/login", json={"username": "first", "password": "pw"})
    client.headers.update({"Authorization": f"Bearer {login.json()['access_token']}"})

    second = client.post(
        "/api/users", json={"username": "second", "firstname": "Second", "lastname": "User", "password": "pw"}
    )
    assert second.status_code == 201
    assert second.json()["admin"] is False


def test_non_admin_cannot_create_user(auth_client, db_session, test_user):
    _make_user(db_session, "plainuser", admin=False)
    plain_headers = _auth_headers(auth_client, "plainuser")

    response = auth_client.post(
        "/api/users",
        json={"username": "another", "firstname": "F", "lastname": "L", "password": "pw"},
        headers=plain_headers,
    )
    assert response.status_code == 403


def test_create_duplicate_username_conflicts(auth_client, test_user):
    auth_client.post("/api/users", json={"username": "dupe", "firstname": "F", "lastname": "L", "password": "pw"})
    response = auth_client.post(
        "/api/users", json={"username": "dupe", "firstname": "F2", "lastname": "L2", "password": "pw"}
    )
    assert response.status_code == 409


def test_list_users_requires_auth(client):
    response = client.get("/api/users")
    assert response.status_code == 401


def test_list_users(auth_client, test_user):
    auth_client.post("/api/users", json={"username": "u1", "firstname": "F", "lastname": "L", "password": "pw"})
    response = auth_client.get("/api/users")
    assert response.status_code == 200
    assert any(u["username"] == "u1" for u in response.json())


def test_update_user(auth_client, test_user):
    created = auth_client.post(
        "/api/users", json={"username": "before", "firstname": "F", "lastname": "L", "password": "pw"}
    ).json()

    response = auth_client.put(f"/api/users/{created['id']}", json={"firstname": "Updated"})
    assert response.status_code == 200

    listed = auth_client.get("/api/users").json()
    updated = next(u for u in listed if u["id"] == created["id"])
    assert updated["firstname"] == "Updated"


def test_non_admin_can_update_own_account(auth_client, db_session, test_user):
    self_user = _make_user(db_session, "selfeditor2", admin=False)
    headers = _auth_headers(auth_client, "selfeditor2")

    response = auth_client.put(f"/api/users/{self_user.id}", json={"firstname": "Updated"}, headers=headers)
    assert response.status_code == 200


def test_non_admin_cannot_update_another_user(auth_client, db_session, test_user):
    target = _make_user(db_session, "target1", admin=False)
    _make_user(db_session, "other3", admin=False)
    headers = _auth_headers(auth_client, "other3")

    response = auth_client.put(f"/api/users/{target.id}", json={"firstname": "Nope"}, headers=headers)
    assert response.status_code == 403


def test_update_missing_user_404s(auth_client, test_user):
    response = auth_client.put("/api/users/999999", json={"firstname": "Nope"})
    assert response.status_code == 404


def test_update_username_conflict(auth_client, test_user):
    auth_client.post("/api/users", json={"username": "taken", "firstname": "F", "lastname": "L", "password": "pw"})
    other = auth_client.post(
        "/api/users", json={"username": "other", "firstname": "F", "lastname": "L", "password": "pw"}
    ).json()

    response = auth_client.put(f"/api/users/{other['id']}", json={"username": "taken"})
    assert response.status_code == 409


def test_delete_user(auth_client, test_user):
    created = auth_client.post(
        "/api/users", json={"username": "todelete", "firstname": "F", "lastname": "L", "password": "pw"}
    ).json()

    response = auth_client.delete(f"/api/users/{created['id']}")
    assert response.status_code == 200

    listed = auth_client.get("/api/users").json()
    assert not any(u["id"] == created["id"] for u in listed)


def test_admin_cannot_delete_own_account(auth_client, test_user):
    response = auth_client.delete(f"/api/users/{test_user.id}")
    assert response.status_code == 403


def test_non_admin_cannot_delete_user(auth_client, db_session, test_user):
    target = _make_user(db_session, "target2", admin=False)
    _make_user(db_session, "other4", admin=False)
    headers = _auth_headers(auth_client, "other4")

    response = auth_client.delete(f"/api/users/{target.id}", headers=headers)
    assert response.status_code == 403


def test_delete_missing_user_404s(auth_client, test_user):
    response = auth_client.delete("/api/users/999999")
    assert response.status_code == 404


def test_get_user_homes_requires_admin_or_self(auth_client, db_session, test_user):
    member = _make_user(db_session, "homemember1", admin=False)
    owner = _make_user(db_session, "homeowner_x", admin=False)
    home = auth_client.post("/api/homes", json={"name": "Casa", "owner_user_id": owner.id}).json()
    auth_client.post(f"/api/homes/{home['id']}/members", json={"user_id": member.id})

    admin_view = auth_client.get(f"/api/users/{member.id}/homes")
    assert admin_view.status_code == 200
    assert any(h["id"] == home["id"] and h["role"] == "member" for h in admin_view.json())

    self_headers = _auth_headers(auth_client, "homemember1")
    self_view = auth_client.get(f"/api/users/{member.id}/homes", headers=self_headers)
    assert self_view.status_code == 200
    assert any(h["id"] == home["id"] for h in self_view.json())

    _make_user(db_session, "outsider_x", admin=False)
    outsider_headers = _auth_headers(auth_client, "outsider_x")
    forbidden = auth_client.get(f"/api/users/{member.id}/homes", headers=outsider_headers)
    assert forbidden.status_code == 403


def test_get_user_homes_missing_user_404s(auth_client, test_user):
    response = auth_client.get("/api/users/999999/homes")
    assert response.status_code == 404


def test_get_user_lists_direct_membership_only(auth_client, db_session, test_user):
    creator = _make_user(db_session, "listcreator_x", admin=False)
    collaborator = _make_user(db_session, "listcollab_x", admin=False)
    creator_headers = _auth_headers(auth_client, "listcreator_x")
    created = auth_client.post(
        "/api/lists", json={"name": "Groceries", "collaborators": [str(collaborator.id)]}, headers=creator_headers
    ).json()

    creator_lists = auth_client.get(f"/api/users/{creator.id}/lists")
    assert creator_lists.status_code == 200
    assert any(lst["id"] == created["id"] for lst in creator_lists.json())

    collaborator_lists = auth_client.get(f"/api/users/{collaborator.id}/lists")
    assert collaborator_lists.status_code == 200
    assert any(lst["id"] == created["id"] for lst in collaborator_lists.json())

    _make_user(db_session, "outsider_y", admin=False)
    outsider_headers = _auth_headers(auth_client, "outsider_y")
    forbidden = auth_client.get(f"/api/users/{creator.id}/lists", headers=outsider_headers)
    assert forbidden.status_code == 403


def test_get_user_lists_excludes_home_only_access(auth_client, db_session, test_user):
    now = datetime.now(UTC)
    owner = _make_user(db_session, "homeowner_y", admin=False)
    home = Home(name="Casa", created_by=owner.id, createdAt=now, updatedAt=now)
    db_session.add(home)
    db_session.flush()
    db_session.add(HomeMember(home_id=home.id, user_id=owner.id, role="owner", createdAt=now))
    db_session.commit()

    created = auth_client.post("/api/lists", json={"name": "Casa List", "home_id": home.id}).json()

    # The owner can open this list via the home, but isn't its creator or an
    # explicit collaborator — list_direct_lists_for_user must exclude it.
    owner_lists = auth_client.get(f"/api/users/{owner.id}/lists")
    assert owner_lists.status_code == 200
    assert not any(lst["id"] == created["id"] for lst in owner_lists.json())


def test_get_user_lists_missing_user_404s(auth_client, test_user):
    response = auth_client.get("/api/users/999999/lists")
    assert response.status_code == 404

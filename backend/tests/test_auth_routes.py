def test_login_success(client, test_user):
    response = client.post("/api/auth/login", json={"username": "admin", "password": "correct-password"})
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["refresh_token"]


def test_login_wrong_password(client, test_user):
    response = client.post("/api/auth/login", json={"username": "admin", "password": "wrong-password"})
    assert response.status_code == 401


def test_login_unknown_user(client):
    response = client.post("/api/auth/login", json={"username": "nobody", "password": "whatever"})
    assert response.status_code == 401


def test_me_requires_token(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_me_with_access_token(auth_client, test_user):
    response = auth_client.get("/api/auth/me")
    assert response.status_code == 200
    assert response.json()["username"] == "admin"


def test_refresh_rotates_token(client, test_user):
    login = client.post("/api/auth/login", json={"username": "admin", "password": "correct-password"})
    old_refresh = login.json()["refresh_token"]

    refreshed = client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
    assert refreshed.status_code == 200
    new_tokens = refreshed.json()
    assert new_tokens["refresh_token"] != old_refresh

    # the old refresh token was single-use — reusing it must fail
    reused = client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
    assert reused.status_code == 401


def test_refresh_with_garbage_token_fails(client):
    response = client.post("/api/auth/refresh", json={"refresh_token": "not-a-real-token"})
    assert response.status_code == 401


def test_logout_revokes_refresh_token(client, test_user):
    login = client.post("/api/auth/login", json={"username": "admin", "password": "correct-password"})
    refresh_token = login.json()["refresh_token"]

    logout = client.post("/api/auth/logout", json={"refresh_token": refresh_token})
    assert logout.status_code == 204

    reused = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert reused.status_code == 401


def test_logout_is_idempotent(client):
    response = client.post("/api/auth/logout", json={"refresh_token": "already-invalid"})
    assert response.status_code == 204


def test_change_password_requires_token(client):
    response = client.put(
        "/api/auth/change-password", json={"current_password": "correct-password", "new_password": "newpassword1"}
    )
    assert response.status_code == 401


def test_change_password_wrong_current_password(auth_client, test_user):
    response = auth_client.put(
        "/api/auth/change-password", json={"current_password": "wrong-password", "new_password": "newpassword1"}
    )
    assert response.status_code == 401


def test_change_password_too_short(auth_client, test_user):
    response = auth_client.put(
        "/api/auth/change-password", json={"current_password": "correct-password", "new_password": "short"}
    )
    assert response.status_code == 422


def test_change_password_success_and_old_password_stops_working(auth_client, test_user):
    response = auth_client.put(
        "/api/auth/change-password", json={"current_password": "correct-password", "new_password": "newpassword1"}
    )
    assert response.status_code == 204

    old_login = auth_client.post("/api/auth/login", json={"username": "admin", "password": "correct-password"})
    assert old_login.status_code == 401

    new_login = auth_client.post("/api/auth/login", json={"username": "admin", "password": "newpassword1"})
    assert new_login.status_code == 200

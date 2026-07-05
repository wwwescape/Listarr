# NOTE: matches existing behavior — the areas endpoints have never required
# auth (same pre-existing gap flagged in routers/users.py), so these tests
# exercise them unauthenticated via the plain `client` fixture.


def test_create_and_list_area(client):
    created = client.post("/api/areas", json={"area_name": "Frozen"})
    assert created.status_code == 201
    body = created.json()
    assert body["area_name"] == "Frozen"
    assert body["status"] == "active"

    listed = client.get("/api/areas")
    assert listed.status_code == 200
    assert any(a["area_name"] == "Frozen" for a in listed.json())


def test_update_area(client):
    created = client.post("/api/areas", json={"area_name": "Dairy"}).json()

    response = client.put(f"/api/areas/{created['id']}", json={"area_name": "Dairy & Eggs"})
    assert response.status_code == 200

    listed = client.get("/api/areas").json()
    updated = next(a for a in listed if a["id"] == created["id"])
    assert updated["area_name"] == "Dairy & Eggs"


def test_update_missing_area_404s(client):
    response = client.put("/api/areas/999999", json={"area_name": "Nope"})
    assert response.status_code == 404


def test_delete_area(client):
    created = client.post("/api/areas", json={"area_name": "Bakery"}).json()

    response = client.delete(f"/api/areas/{created['id']}")
    assert response.status_code == 200

    listed = client.get("/api/areas").json()
    assert not any(a["id"] == created["id"] for a in listed)


def test_delete_missing_area_404s(client):
    response = client.delete("/api/areas/999999")
    assert response.status_code == 404

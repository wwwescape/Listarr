def test_create_and_list_location(client):
    created = client.post("/api/locations", json={"location_name": "Garage"})
    assert created.status_code == 201
    body = created.json()
    assert body["location_name"] == "Garage"
    assert body["status"] == "active"

    listed = client.get("/api/locations")
    assert listed.status_code == 200
    assert any(location["location_name"] == "Garage" for location in listed.json())


def test_update_location(client):
    created = client.post("/api/locations", json={"location_name": "Pantry"}).json()

    response = client.put(f"/api/locations/{created['id']}", json={"location_name": "Kitchen Pantry"})
    assert response.status_code == 200

    listed = client.get("/api/locations").json()
    updated = next(location for location in listed if location["id"] == created["id"])
    assert updated["location_name"] == "Kitchen Pantry"


def test_update_missing_location_404s(client):
    response = client.put("/api/locations/999999", json={"location_name": "Nope"})
    assert response.status_code == 404


def test_delete_location(client):
    created = client.post("/api/locations", json={"location_name": "Attic"}).json()

    response = client.delete(f"/api/locations/{created['id']}")
    assert response.status_code == 200

    listed = client.get("/api/locations").json()
    assert not any(location["id"] == created["id"] for location in listed)


def test_delete_missing_location_404s(client):
    response = client.delete("/api/locations/999999")
    assert response.status_code == 404

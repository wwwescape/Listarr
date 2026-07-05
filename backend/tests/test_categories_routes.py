def test_create_and_list_category(client):
    created = client.post("/api/categories", json={"category_name": "Snacks"})
    assert created.status_code == 201
    body = created.json()
    assert body["category_name"] == "Snacks"
    assert body["status"] == "active"

    listed = client.get("/api/categories")
    assert listed.status_code == 200
    assert any(c["category_name"] == "Snacks" for c in listed.json())


def test_update_category(client):
    created = client.post("/api/categories", json={"category_name": "Drinks"}).json()

    response = client.put(f"/api/categories/{created['id']}", json={"category_name": "Beverages"})
    assert response.status_code == 200

    listed = client.get("/api/categories").json()
    updated = next(c for c in listed if c["id"] == created["id"])
    assert updated["category_name"] == "Beverages"


def test_update_missing_category_404s(client):
    response = client.put("/api/categories/999999", json={"category_name": "Nope"})
    assert response.status_code == 404


def test_delete_category(client):
    created = client.post("/api/categories", json={"category_name": "Cleaning"}).json()

    response = client.delete(f"/api/categories/{created['id']}")
    assert response.status_code == 200

    listed = client.get("/api/categories").json()
    assert not any(c["id"] == created["id"] for c in listed)


def test_delete_missing_category_404s(client):
    response = client.delete("/api/categories/999999")
    assert response.status_code == 404


def test_delete_category_still_in_use_conflicts(client):
    category = client.post("/api/categories", json={"category_name": "Produce"}).json()
    client.post("/api/items", json={"item_name": "Apples", "category_id": category["id"]})

    response = client.delete(f"/api/categories/{category['id']}")
    assert response.status_code == 409

    listed = client.get("/api/categories").json()
    assert any(c["id"] == category["id"] for c in listed)

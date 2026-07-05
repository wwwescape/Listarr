def test_stats_empty_by_default(auth_client, test_user):
    response = auth_client.get("/api/stats")
    assert response.status_code == 200
    body = response.json()
    assert body["total_lists"] == 0
    assert body["total_items"] == 0
    assert body["completion_rate"] == 0
    assert body["most_purchased"] == []
    assert body["category_breakdown"] == []
    assert len(body["activity_by_week"]) == 8


def test_stats_requires_auth(client):
    response = client.get("/api/stats")
    assert response.status_code == 401


def test_stats_counts_checked_items(auth_client, test_user):
    created = auth_client.post("/api/lists", json={"name": "Groceries"}).json()
    item1 = auth_client.post(f"/api/lists/list/{created['id']}/items", json={"name": "Milk"}).json()
    auth_client.post(f"/api/lists/list/{created['id']}/items", json={"name": "Bread"})
    auth_client.put(f"/api/lists/list/{created['id']}/items/{item1['id']}", json={"checked": True})

    response = auth_client.get("/api/stats").json()
    assert response["total_lists"] == 1
    assert response["total_items"] == 2
    assert response["completed_items"] == 1
    assert response["completion_rate"] == 50
    assert any(entry["label"] == "milk" and entry["count"] == 1 for entry in response["most_purchased"])

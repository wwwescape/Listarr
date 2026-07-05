from datetime import UTC, datetime

from app.models import Category, List, ListItem


def _make_category(db_session, name="Produce"):
    now = datetime.now(UTC)
    category = Category(category_name=name, status="active", createdAt=now, updatedAt=now)
    db_session.add(category)
    db_session.commit()
    return category


def test_create_and_list_item(client, db_session):
    category = _make_category(db_session)

    created = client.post("/api/items", json={"item_name": "Apples", "category_id": category.id})
    assert created.status_code == 201
    body = created.json()
    assert body["item_name"] == "Apples"
    assert body["purchase_count"] == 0

    listed = client.get("/api/items")
    assert listed.status_code == 200
    assert any(i["item_name"] == "Apples" for i in listed.json())


def test_items_sorted_by_purchase_count(client, db_session):
    category = _make_category(db_session)
    now = datetime.now(UTC)

    popular = client.post("/api/items", json={"item_name": "Milk", "category_id": category.id}).json()
    rare = client.post("/api/items", json={"item_name": "Truffle Oil", "category_id": category.id}).json()

    # A checked-off list item against "Milk" (in some list) counts as one purchase.
    the_list = List(
        name="Groceries",
        createdBy="1",
        status="active",
        createdAt=now,
        updatedAt=now,
    )
    db_session.add(the_list)
    db_session.commit()

    db_session.add(
        ListItem(
            list_id=the_list.id,
            item_id=popular["id"],
            name="Milk",
            quantity=1,
            checked=True,
            checked_at=now,
            createdAt=now,
            updatedAt=now,
        )
    )
    db_session.commit()

    listed = client.get("/api/items").json()
    names_in_order = [i["item_name"] for i in listed]
    assert names_in_order.index("Milk") < names_in_order.index("Truffle Oil")
    assert next(i for i in listed if i["item_name"] == "Milk")["purchase_count"] == 1
    assert rare["item_name"] == "Truffle Oil"


def test_update_item(client, db_session):
    category = _make_category(db_session)
    created = client.post("/api/items", json={"item_name": "Bread", "category_id": category.id}).json()

    response = client.put(f"/api/items/{created['id']}", json={"item_name": "Sourdough Bread"})
    assert response.status_code == 200

    listed = client.get("/api/items").json()
    updated = next(i for i in listed if i["id"] == created["id"])
    assert updated["item_name"] == "Sourdough Bread"


def test_update_missing_item_404s(client):
    response = client.put("/api/items/999999", json={"item_name": "Nope"})
    assert response.status_code == 404


def test_delete_item(client, db_session):
    category = _make_category(db_session)
    created = client.post("/api/items", json={"item_name": "Eggs", "category_id": category.id}).json()

    response = client.delete(f"/api/items/{created['id']}")
    assert response.status_code == 200

    listed = client.get("/api/items").json()
    assert not any(i["id"] == created["id"] for i in listed)


def test_delete_missing_item_404s(client):
    response = client.delete("/api/items/999999")
    assert response.status_code == 404


def test_suggestions_empty_by_default(client):
    response = client.get("/api/items/suggestions")
    assert response.status_code == 200
    body = response.json()
    assert body == {"favourites": [], "recent": [], "frequent": []}


def test_suggestions_includes_favourites_and_recent(client, db_session):
    now = datetime.now(UTC)
    the_list = List(name="Groceries", createdBy="1", status="active", createdAt=now, updatedAt=now)
    db_session.add(the_list)
    db_session.commit()

    db_session.add(
        ListItem(
            list_id=the_list.id,
            name="Chocolate",
            quantity=1,
            favourite=True,
            checked=False,
            createdAt=now,
            updatedAt=now,
        )
    )
    db_session.add(
        ListItem(
            list_id=the_list.id,
            name="Coffee",
            quantity=1,
            favourite=False,
            checked=True,
            checked_at=now,
            createdAt=now,
            updatedAt=now,
        )
    )
    db_session.commit()

    response = client.get("/api/items/suggestions").json()
    assert any(row["name"] == "Chocolate" for row in response["favourites"])
    assert any(row["name"] == "Coffee" for row in response["recent"])
    assert any(row["name"] == "Coffee" for row in response["frequent"])

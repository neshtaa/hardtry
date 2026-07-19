from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_echo_returns_same_payload():
    payload = {"hello": "world", "number": 42}
    response = client.post("/echo", json=payload)
    assert response.status_code == 200
    assert response.json() == payload


def test_echo_with_empty_object():
    payload = {}
    response = client.post("/echo", json=payload)
    assert response.status_code == 200
    assert response.json() == {}


def test_echo_with_list():
    payload = [1, 2, 3]
    response = client.post("/echo", json=payload)
    assert response.status_code == 200
    assert response.json() == payload

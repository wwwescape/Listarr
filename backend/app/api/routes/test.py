from fastapi import APIRouter

router = APIRouter(prefix="/api/test", tags=["test"])


@router.get("")
def test_endpoint():
    return {"message": "API Test Successful!"}

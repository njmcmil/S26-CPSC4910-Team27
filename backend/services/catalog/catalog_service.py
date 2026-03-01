# services/catalog/catalog_service.py

from shared.db import get_connection


def get_sponsor_catalog(sponsor_user_id: int):
    """
    Fetch products that sponsor added to their catalog.
    Returns data formatted to match frontend Product type.
    """

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT 
                item_id,
                title,
                price_value,
                price_currency,
                image_url,
                rating
            FROM SponsorCatalog
            WHERE sponsor_user_id = %s
            """,
            (sponsor_user_id,)
        )

        items = cursor.fetchall()

        # Format response to match frontend structure
        formatted_items = [
            {
                "itemId": item["item_id"],
                "title": item["title"],
                "price": {
                    "value": item["price_value"],
                    "currency": item["price_currency"],
                } if item["price_value"] else None,
                "image": {
                    "imageUrl": item["image_url"]
                } if item["image_url"] else None,
                "rating": item["rating"]
            }
            for item in items
        ]

        return formatted_items

    finally:
        cursor.close()
        conn.close()

def add_to_catalog(sponsor_user_id: int, product: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        price = product.get("price") or {}
        image = product.get("image") or {}
        points_cost = int(product.get("points_cost") or 0)

        cursor.execute("""
            INSERT INTO SponsorCatalog
            (sponsor_user_id, item_id, title, price_value, price_currency, image_url, rating, points_cost)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                title = VALUES(title),
                price_value = VALUES(price_value),
                price_currency = VALUES(price_currency),
                image_url = VALUES(image_url),
                rating = VALUES(rating),
                points_cost = VALUES(points_cost)
        """, (
            sponsor_user_id,
            product["itemId"],
            product["title"],
            price.get("value"),
            price.get("currency"),
            image.get("imageUrl"),
            product.get("rating"),
            points_cost
        ))

        conn.commit()

    finally:
        cursor.close()
        conn.close()

def remove_from_catalog(sponsor_user_id: int, item_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "DELETE FROM SponsorCatalog WHERE item_id = %s AND sponsor_user_id = %s",
            (item_id, sponsor_user_id)
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()
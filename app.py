import os 
import re
import sqlite3
import secrets
from datetime import date
from functools import wraps

from flask import (
    Flask, jsonify, render_template, request, session
)
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)

app.secret_key = os.environ.get(
    "FLASK_SECRET_KEY",
    "development-only-change-this-secret"
)

app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax"
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "cinebook.db")

# ========================================
# MOVIES
# ========================================
MOVIES = {
    1: {
        "id": 1,
        "title": "Avengers: Endgame",
        "category": "action",
        "language": "English",
        "rating": "8.4/10",
        "price": 180
    },
    2: {
        "id": 2,
        "title": "Bhool Bhulaiyaa 3",
        "category": "comedy",
        "language": "Hindi",
        "rating": "6.2/10",
        "price": 150
    },
    3: {
        "id": 3,
        "title": "3 Idiots",
        "category": "drama",
        "language": "Hindi",
        "rating": "8.4/10",
        "price": 120
    },
    4: {
        "id": 4,
        "title": "Interstellar",
        "category": "sci-fi",
        "language": "English",
        "rating": "8.7/10",
        "price": 200
    },
    5: {
        "id": 5,
        "title": "Jawan",
        "category": "action",
        "language": "Hindi",
        "rating": "6.9/10",
        "price": 160
    }
}

ALLOWED_TIMES = {
    "10:00",
    "13:30",
    "17:00",
    "20:30"
}

VALID_SEATS = {
    f"{row}{number}"
    for row in "ABCDEFGH"
    for number in range(1, 11)
}


# ========================================
# DATABASE
# ========================================
def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                movie_id INTEGER NOT NULL,
                show_date TEXT NOT NULL,
                show_time TEXT NOT NULL,
                seat_code TEXT NOT NULL,
                total_amount REAL NOT NULL,
                status TEXT NOT NULL DEFAULT 'confirmed'
                    CHECK(status IN ('confirmed', 'cancelled')),
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(movie_id, show_date, show_time, seat_code)
            );
        """)


init_db()


# ========================================
# LOGIN PROTECTION
# ========================================
def login_required(function):
    @wraps(function)
    def wrapper(*args, **kwargs):
        if not session.get("user_id"):
            return jsonify({
                "error": "Please log in first."
            }), 401

        return function(*args, **kwargs)

    return wrapper


# ========================================
# HOME PAGE
# ========================================
@app.get("/")
def home():
    return render_template("index.html")


# ========================================
# HEALTH CHECK
# ========================================
@app.get("/api/health")
def health():
    try:
        with get_db() as conn:
            conn.execute("SELECT 1").fetchone()

        return jsonify({
            "status": "ok",
            "database": "connected"
        })

    except sqlite3.Error:
        app.logger.exception("Database health check failed")

        return jsonify({
            "status": "error",
            "message": "Database connection failed."
        }), 503


# ========================================
# REGISTER
# ========================================
@app.post("/api/register")
def register():
    data = request.get_json(silent=True) or {}

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name or len(name) > 100:
        return jsonify({
            "error": "Enter a valid name."
        }), 400

    email_pattern = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"

    if not re.match(email_pattern, email):
        return jsonify({
            "error": "Enter a valid email address."
        }), 400

    if not isinstance(password, str) or len(password) < 8:
        return jsonify({
            "error": "Password must contain at least 8 characters."
        }), 400

    if len(password) > 128:
        return jsonify({
            "error": "Password is too long."
        }), 400

    try:
        with get_db() as conn:
            cursor = conn.execute(
                """
                INSERT INTO users (name, email, password_hash)
                VALUES (?, ?, ?)
                """,
                (
                    name,
                    email,
                    generate_password_hash(password)
                )
            )

            user_id = cursor.lastrowid

        session.clear()
        session["user_id"] = user_id
        session["user_name"] = name
        session["user_email"] = email

        return jsonify({
            "message": "Account created successfully.",
            "user": {
                "name": name,
                "email": email
            }
        }), 201

    except sqlite3.IntegrityError:
        return jsonify({
            "error": "This email is already registered. Please log in."
        }), 409

    except sqlite3.Error:
        app.logger.exception("Registration failed")

        return jsonify({
            "error": "Could not create account."
        }), 500


# ========================================
# LOGIN
# ========================================
@app.post("/api/login")
def login():
    data = request.get_json(silent=True) or {}

    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({
            "error": "Enter your email and password."
        }), 400

    try:
        with get_db() as conn:
            user = conn.execute(
                """
                SELECT id, name, email, password_hash
                FROM users
                WHERE email = ?
                """,
                (email,)
            ).fetchone()

        if (
            not user
            or not check_password_hash(
                user["password_hash"],
                password
            )
        ):
            return jsonify({
                "error": "Incorrect email or password."
            }), 401

        session.clear()
        session["user_id"] = user["id"]
        session["user_name"] = user["name"]
        session["user_email"] = user["email"]

        return jsonify({
            "message": "Login successful.",
            "user": {
                "name": user["name"],
                "email": user["email"]
            }
        })

    except sqlite3.Error:
        app.logger.exception("Login failed")

        return jsonify({
            "error": "Could not log in."
        }), 500


# ========================================
# LOGOUT
# ========================================
@app.post("/api/logout")
def logout():
    session.clear()

    return jsonify({
        "message": "Logged out successfully."
    })


# ========================================
# CURRENT USER
# ========================================
@app.get("/api/me")
def me():
    if not session.get("user_id"):
        return jsonify({
            "logged_in": False
        })

    return jsonify({
        "logged_in": True,
        "user": {
            "name": session.get("user_name"),
            "email": session.get("user_email")
        }
    })


# ========================================
# MOVIE LIST
# ========================================
@app.get("/api/movies")
def movies():
    return jsonify(list(MOVIES.values()))


# ========================================
# AVAILABLE SEATS
# ========================================
@app.get("/api/seats")
def seats():
    movie_id = request.args.get("movie_id", type=int)
    show_date = request.args.get("show_date", "")
    show_time = request.args.get("show_time", "")

    if (
        movie_id not in MOVIES
        or not show_date
        or not show_time
    ):
        return jsonify({
            "error": "Choose a valid movie, date and show time."
        }), 400

    try:
        parsed_date = date.fromisoformat(show_date)

        if parsed_date < date.today():
            return jsonify({
                "error": "Past dates are not available."
            }), 400

    except ValueError:
        return jsonify({
            "error": "Invalid date."
        }), 400

    if show_time not in ALLOWED_TIMES:
        return jsonify({
            "error": "Invalid show time."
        }), 400

    try:
        with get_db() as conn:
            rows = conn.execute(
                """
                SELECT seat_code
                FROM bookings
                WHERE movie_id = ?
                  AND show_date = ?
                  AND show_time = ?
                  AND status = 'confirmed'
                """,
                (movie_id, show_date, show_time)
            ).fetchall()

        return jsonify({
            "movie_id": movie_id,
            "show_date": show_date,
            "show_time": show_time,
            "booked_seats": [
                row["seat_code"] for row in rows
            ]
        })

    except sqlite3.Error:
        app.logger.exception("Seat lookup failed")

        return jsonify({
            "error": "Could not load available seats."
        }), 500


# ========================================
# CREATE BOOKING
# ========================================
@app.post("/api/bookings")
@login_required
def create_booking():
    data = request.get_json(silent=True) or {}

    movie_id = data.get("movie_id")
    show_date = data.get("show_date")
    show_time = data.get("show_time")
    selected_seats = data.get("seats")

    if (
        isinstance(movie_id, bool)
        or not isinstance(movie_id, int)
        or movie_id not in MOVIES
    ):
        return jsonify({
            "error": "Choose a valid movie."
        }), 400

    if not isinstance(show_date, str):
        return jsonify({
            "error": "Choose a valid show date."
        }), 400

    try:
        parsed_date = date.fromisoformat(show_date)

        if parsed_date < date.today():
            return jsonify({
                "error": "Past dates cannot be booked."
            }), 400

    except ValueError:
        return jsonify({
            "error": "Invalid show date."
        }), 400

    if show_time not in ALLOWED_TIMES:
        return jsonify({
            "error": "Please select a valid show time."
        }), 400

    if (
        not isinstance(selected_seats, list)
        or not 1 <= len(selected_seats) <= 10
    ):
        return jsonify({
            "error": "Select between 1 and 10 seats."
        }), 400

    if any(
        not isinstance(seat, str)
        or seat not in VALID_SEATS
        for seat in selected_seats
    ):
        return jsonify({
            "error": "Invalid seat selection."
        }), 400

    if len(set(selected_seats)) != len(selected_seats):
        return jsonify({
            "error": "Duplicate seats are not allowed."
        }), 400

    price = MOVIES[movie_id]["price"]
    total_amount = price * len(selected_seats)

    try:
        with get_db() as conn:
            # Begin a transaction so the complete booking succeeds
            # or all seat inserts are rolled back.
            conn.execute("BEGIN IMMEDIATE")

            placeholders = ",".join("?" for _ in selected_seats)

            already_booked = conn.execute(
                f"""
                SELECT seat_code
                FROM bookings
                WHERE movie_id = ?
                  AND show_date = ?
                  AND show_time = ?
                  AND status = 'confirmed'
                  AND seat_code IN ({placeholders})
                """,
                (
                    movie_id,
                    show_date,
                    show_time,
                    *selected_seats
                )
            ).fetchall()

            if already_booked:
                conn.rollback()

                return jsonify({
                    "error": "These seats are already booked: "
                    + ", ".join(
                        row["seat_code"] for row in already_booked
                    )
                }), 409

            booking_ids = []

            for seat in selected_seats:
                cursor = conn.execute(
                    """
                    INSERT INTO bookings (
                        user_id,
                        movie_id,
                        show_date,
                        show_time,
                        seat_code,
                        total_amount,
                        status
                    )
                    VALUES (?, ?, ?, ?, ?, ?, 'confirmed')
                    """,
                    (
                        session["user_id"],
                        movie_id,
                        show_date,
                        show_time,
                        seat,
                        total_amount
                    )
                )

                booking_ids.append(cursor.lastrowid)

            # Commit the complete booking.
            conn.commit()

        return jsonify({
            "message": "Booking confirmed! No payment was taken.",
            "booking_reference": f"CB{booking_ids[0]:06d}",
            "movie": MOVIES[movie_id]["title"],
            "movie_id": movie_id,
            "show_date": show_date,
            "show_time": show_time,
            "seats": selected_seats,
            "ticket_price": price,
            "total_amount": total_amount
        }), 201

    except sqlite3.IntegrityError:
        app.logger.exception("Booking conflict")

        return jsonify({
            "error": "A seat was booked by another user. Refresh seats and try again."
        }), 409

    except sqlite3.Error:
        app.logger.exception("Booking failed")

        return jsonify({
            "error": "Booking failed. Please try again."
        }), 500


# ========================================
# MY BOOKINGS
# ========================================
@app.get("/api/my-bookings")
@login_required
def my_bookings():
    try:
        with get_db() as conn:
            rows = conn.execute(
                """
                SELECT
                    b.id,
                    b.movie_id,
                    b.show_date,
                    b.show_time,
                    b.seat_code,
                    b.total_amount,
                    b.status,
                    b.created_at
                FROM bookings b
                WHERE b.user_id = ?
                ORDER BY b.created_at DESC, b.id DESC
                """,
                (session["user_id"],)
            ).fetchall()

        result = []

        for row in rows:
            booking = dict(row)
            movie = MOVIES.get(booking["movie_id"])

            booking["movie_title"] = (
                movie["title"] if movie else "Unknown movie"
            )

            result.append(booking)

        return jsonify(result)

    except sqlite3.Error:
        app.logger.exception("Booking history failed")

        return jsonify({
            "error": "Could not load booking history."
        }), 500


# ========================================
# RUN SERVER
# ========================================
if __name__ == "__main__":
    # Debug mode is intended only for local development.
    app.run(
        host="127.0.0.1",
        port=5001,
        debug=True
    )

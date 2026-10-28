"use strict";

const API = "/api";

const searchInput = document.getElementById("searchInput");
const movieCards = document.querySelectorAll(".movie-card");
const filterButtons = document.querySelectorAll(".filter-btn");
const noResults = document.getElementById("noResults");

const loginModal = document.getElementById("loginModal");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const bookingModal = document.getElementById("bookingModal");
const bookingDate = document.getElementById("bookingDate");
const bookingShow = document.getElementById("bookingShow");
const seatSection = document.getElementById("seatSection");
const seatLayout = document.getElementById("seatLayout");
const selectedSeatsText = document.getElementById("selectedSeats");
const totalPriceText = document.getElementById("totalPrice");

let selectedCategory = "all";
let currentMovie = null;
let currentPrice = 0;
let bookedSeats = [];
let selectedSeats = new Set();

const movieIds = {
    "Avengers: Endgame": 1,
    "Bhool Bhulaiyaa 3": 2,
    "3 Idiots": 3,
    "Interstellar": 4,
    "Jawan": 5
};

const moviePrices = {
    1: 180,
    2: 150,
    3: 120,
    4: 200,
    5: 160
};

const timeMap = {
    "10:00 AM": "10:00",
    "01:30 PM": "13:30",
    "05:00 PM": "17:00",
    "08:30 PM": "20:30"
};

function todayString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

async function apiRequest(endpoint, options = {}) {
    const response = await fetch(`${API}${endpoint}`, {
        ...options,
        credentials: "same-origin",
        headers: {
            ...(options.headers || {}),
            ...(options.body ? {
                "Content-Type": "application/json"
            } : {})
        }
    });

    let data;

    try {
        data = await response.json();
    } catch {
        throw new Error("Server response invalid hai. Flask terminal check karo.");
    }

    if (!response.ok) {
        throw new Error(
            data.error || data.message || `Request failed (${response.status})`
        );
    }

    return data;
}

// ========================================
// SEARCH AND CATEGORY FILTER
// ========================================
function filterMovies() {
    const query = searchInput
        ? searchInput.value.trim().toLowerCase()
        : "";

    let visibleCount = 0;

    movieCards.forEach((card) => {
        const title = (
            card.dataset.title ||
            card.querySelector("h3")?.textContent ||
            ""
        ).toLowerCase();

        const category = (card.dataset.category || "").toLowerCase();

        const visible =
            title.includes(query) &&
            (selectedCategory === "all" ||
                category === selectedCategory);

        card.hidden = !visible;
        if (visible) visibleCount++;
    });

    if (noResults) noResults.hidden = visibleCount !== 0;
}

if (searchInput) {
    searchInput.addEventListener("input", filterMovies);
}

filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
        selectedCategory = (button.dataset.filter || "all").toLowerCase();

        filterButtons.forEach((item) => item.classList.remove("active"));
        button.classList.add("active");

        filterMovies();
    });
});

// ========================================
// LOGIN / SIGNUP MODAL
// ========================================
function showLogin() {
    if (!loginModal) return;
    loginModal.hidden = false;
    loginModal.style.display = "flex";
}

function closeLogin() {
    if (!loginModal) return;
    loginModal.hidden = true;
    loginModal.style.display = "none";
}

window.showLogin = showLogin;
window.closeLogin = closeLogin;

if (loginModal) {
    loginModal.addEventListener("click", (event) => {
        if (event.target === loginModal) closeLogin();
    });
}

async function checkLogin() {
    try {
        const result = await apiRequest("/me");
        return result.logged_in === true;
    } catch {
        return false;
    }
}

if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;
        const button = loginForm.querySelector('button[type="submit"]');

        if (button) {
            button.disabled = true;
            button.textContent = "Logging in...";
        }

        try {
            const result = await apiRequest("/login", {
                method: "POST",
                body: JSON.stringify({ email, password })
            });

            alert(result.message || "Login successful!");
            loginForm.reset();
            closeLogin();
        } catch (error) {
            alert("Login failed: " + error.message);
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = "Login";
            }
        }
    });
}

if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const name = document.getElementById("registerName").value.trim();
        const email = document.getElementById("registerEmail").value.trim();
        const password = document.getElementById("registerPassword").value;
        const button = registerForm.querySelector('button[type="submit"]');

        if (password.length < 8) {
            alert("Password minimum 8 characters ka hona chahiye.");
            return;
        }

        if (button) {
            button.disabled = true;
            button.textContent = "Creating account...";
        }

        try {
            const result = await apiRequest("/register", {
                method: "POST",
                body: JSON.stringify({ name, email, password })
            });

            alert(result.message || "Account created!");
            registerForm.reset();
            closeLogin();
        } catch (error) {
            alert("Signup failed: " + error.message);
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = "Sign Up";
            }
        }
    });
}

// ========================================
// BOOKING MODAL
// ========================================
function openModal(modal) {
    if (!modal) return;
    modal.hidden = false;
    modal.style.display = "flex";
}

function closeBooking() {
    if (!bookingModal) return;
    bookingModal.hidden = true;
    bookingModal.style.display = "none";
}

window.closeBooking = closeBooking;

if (bookingModal) {
    bookingModal.addEventListener("click", (event) => {
        if (event.target === bookingModal) closeBooking();
    });
}

async function bookMovie(movieName) {
    const movieId = movieIds[movieName];

    if (!movieId) {
        alert("Movie ID nahi mila: " + movieName);
        return;
    }

    if (!(await checkLogin())) {
        alert("Booking se pehle login karo.");
        showLogin();
        return;
    }

    currentMovie = {
        id: movieId,
        title: movieName
    };

    currentPrice = moviePrices[movieId] || 0;
    selectedSeats.clear();
    bookedSeats = [];

    document.getElementById("selectedMovieName").textContent =
        `${movieName} — ₹${currentPrice} per seat`;

    if (bookingDate) {
        bookingDate.min = todayString();
        bookingDate.value = todayString();
    }

    if (bookingShow) bookingShow.value = "05:00 PM";

    if (seatSection) seatSection.hidden = true;

    updatePriceSummary();
    openModal(bookingModal);
}

window.bookMovie = bookMovie;

// ========================================
// SEAT SELECTION
// ========================================
async function openSeatSelection() {
    if (!currentMovie) {
        alert("Select Movie First.");
        return;
    }

    const showDate = bookingDate?.value;
    const displayTime = bookingShow?.value;
    const showTime = timeMap[displayTime];

    if (!showDate) {
        alert("Show date select karo.");
        return;
    }

    if (showDate < todayString()) {
        alert("Past date ki booking nahi kar sakte.");
        return;
    }

    if (!showTime) {
        alert("Valid show timing select karo.");
        return;
    }

    try {
        const result = await apiRequest(
            `/seats?movie_id=${currentMovie.id}` +
            `&show_date=${encodeURIComponent(showDate)}` +
            `&show_time=${encodeURIComponent(showTime)}`
        );

        bookedSeats = result.booked_seats || [];
        selectedSeats.clear();

        renderSeats();
        updatePriceSummary();

        if (seatSection) seatSection.hidden = false;
    } catch (error) {
        alert("Seats load nahi hui: " + error.message);
    }
}

window.openSeatSelection = openSeatSelection;

function renderSeats() {
    if (!seatLayout) return;

    seatLayout.innerHTML = "";

    for (const row of "ABCDEFGH") {
        const rowElement = document.createElement("div");
        rowElement.className = "seat-row";

        for (let number = 1; number <= 10; number++) {
            const seatCode = `${row}${number}`;
            const seat = document.createElement("button");

            seat.type = "button";
            seat.className = "seat";
            seat.textContent = seatCode;
            seat.setAttribute("aria-label", `Seat ${seatCode}`);

            if (bookedSeats.includes(seatCode)) {
                seat.classList.add("booked");
                seat.disabled = true;
                seat.title = "Already booked";
            } else {
                seat.classList.add("available");
                seat.title = `Select seat ${seatCode}`;

                seat.addEventListener("click", () => {
                    if (selectedSeats.has(seatCode)) {
                        selectedSeats.delete(seatCode);
                        seat.classList.remove("selected");
                        seat.classList.add("available");
                    } else {
                        if (selectedSeats.size >= 10) {
                            alert("Ek booking mein maximum 10 seats select kar sakte ho.");
                            return;
                        }

                        selectedSeats.add(seatCode);
                        seat.classList.remove("available");
                        seat.classList.add("selected");
                    }

                    updatePriceSummary();
                });
            }

            rowElement.appendChild(seat);
        }

        seatLayout.appendChild(rowElement);
    }
}

function updatePriceSummary() {
    if (selectedSeatsText) {
        selectedSeatsText.textContent = selectedSeats.size
            ? [...selectedSeats].sort().join(", ")
            : "None";
    }

    if (totalPriceText) {
        totalPriceText.textContent = String(selectedSeats.size * currentPrice);
    }

    // Existing HTML price labels ko actual movie price ke saath match karo.
    const priceInfo = document.querySelector(".price-info");
    if (priceInfo) {
        const paragraphs = priceInfo.querySelectorAll("p");

        if (paragraphs.length >= 3) {
            paragraphs[0].textContent = `Ticket price per seat: ₹${currentPrice}`;
            paragraphs[1].textContent = "All seats have the same price";
            paragraphs[2].textContent = `Selected seats: ${selectedSeats.size}`;
        }
    }
}
/* ===== PREMIUM CINEBOOK POPUP ===== */

function addCineBookStyles() {
    if (document.getElementById("cinebook-premium-css")) return;

    const style = document.createElement("style");
    style.id = "cinebook-premium-css";
    style.textContent = `
        .cb-overlay {
            position: fixed;
            inset: 0;
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 18px;
            background: rgba(5, 6, 15, .82);
            backdrop-filter: blur(10px);
            animation: cbFade .2s ease;
        }

        .cb-card {
            width: 100%;
            max-width: 420px;
            color: #fff;
            background: linear-gradient(145deg, #242432, #101019);
            border: 1px solid #393947;
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 25px 80px #0009;
            font-family: inherit;
            animation: cbSlide .28s ease;
        }

        .cb-head {
            padding: 25px 24px 18px;
        }

        .cb-icon {
            font-size: 28px;
            margin-bottom: 12px;
        }

        .cb-title {
            margin: 0;
            font-size: 25px;
            font-weight: 800;
        }

        .cb-sub {
            color: #aaaabd;
            font-size: 13px;
            line-height: 1.6;
            margin: 8px 0 0;
        }

        .cb-details {
            margin: 0 22px;
            padding: 17px;
            background: #ffffff08;
            border: 1px solid #ffffff12;
            border-radius: 16px;
        }

        .cb-movie {
            font-size: 16px;
            font-weight: 750;
            margin-bottom: 12px;
        }

        .cb-row {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            padding: 8px 0;
            font-size: 13px;
            color: #b8b8c8;
        }

        .cb-row strong {
            color: white;
            text-align: right;
            overflow-wrap: anywhere;
        }

        .cb-seats {
            color: #fb7185 !important;
        }

        .cb-total {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin: 18px 22px;
            padding-top: 16px;
            border-top: 1px dashed #ffffff30;
            color: #b8b8c8;
            font-size: 14px;
        }

        .cb-total strong {
            color: #fb7185;
            font-size: 26px;
        }

        .cb-actions {
            display: flex;
            gap: 10px;
            padding: 0 22px 23px;
        }

        .cb-btn {
            border: 0;
            border-radius: 12px;
            padding: 14px 12px;
            font-size: 13px;
            font-weight: 750;
            cursor: pointer;
            transition: .2s;
        }

        .cb-btn:hover {
            transform: translateY(-2px);
        }

        .cb-cancel {
            flex: 1;
            color: white;
            background: #ffffff12;
            border: 1px solid #ffffff18;
        }

        .cb-confirm {
            flex: 1.5;
            color: white;
            background: linear-gradient(135deg, #fb4165, #c20c39);
            box-shadow: 0 6px 20px #e11d4833;
        }

        .cb-btn:disabled {
            opacity: .6;
            cursor: wait;
        }

        .cb-success {
            text-align: center;
            padding: 27px 22px 18px;
        }

        .cb-check {
            width: 68px;
            height: 68px;
            margin: 0 auto 16px;
            display: grid;
            place-items: center;
            border-radius: 50%;
            background: #22c55e20;
            border: 1px solid #4ade8055;
            color: #86efac;
            font-size: 35px;
        }

        .cb-reference {
            color: #86efac;
            font-size: 12px;
            margin-top: 12px;
            overflow-wrap: anywhere;
        }

        @keyframes cbFade {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes cbSlide {
            from { opacity: 0; transform: translateY(15px) scale(.97); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @media (prefers-reduced-motion: reduce) {
            .cb-overlay, .cb-card { animation: none; }
        }
    `;

    document.head.appendChild(style);
}

function cbEscape(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[c]);
}

function cineBookPopup({
    title,
    subtitle,
    icon = "🎬",
    movie = "",
    date = "",
    time = "",
    seats = "",
    count = "",
    total = "",
    reference = "",
    success = false
}) {
    addCineBookStyles();

    return new Promise(resolve => {
        const overlay = document.createElement("div");
        overlay.className = "cb-overlay";

        const safeMovie = cbEscape(movie);
        const safeDate = cbEscape(date);
        const safeTime = cbEscape(time);
        const safeSeats = cbEscape(seats);
        const safeTotal = cbEscape(total);
        const safeReference = cbEscape(reference);

        const qrData = encodeURIComponent(
            `CineBook Ticket | Booking ID: ${reference}`
        );

        const qrUrl =
            `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${qrData}`;

        const details = `
            <div class="cb-details">
                <div class="cb-movie">🎬 ${safeMovie}</div>
                <div class="cb-row">
                    <span>📅 Date</span>
                    <strong>${safeDate}</strong>
                </div>
                <div class="cb-row">
                    <span>🕒 Showtime</span>
                    <strong>${safeTime}</strong>
                </div>
                <div class="cb-row">
                    <span>💺 Seats</span>
                    <strong class="cb-seats">${safeSeats}</strong>
                </div>
                ${count !== "" ? `
                <div class="cb-row">
                    <span>🎟️ Tickets</span>
                    <strong>${cbEscape(count)}</strong>
                </div>` : ""}
            </div>

            <div class="cb-total">
                <span>Total amount</span>
                <strong>₹${safeTotal}</strong>
            </div>
        `;

        overlay.innerHTML = `
            <section class="cb-card"
                role="dialog"
                aria-modal="true"
                aria-label="${success ? "Your E-Ticket" : "Confirm booking"}">

                ${success ? `
                    <div class="cb-success">
                        <div class="cb-check">✓</div>
                        <h2 class="cb-title">E-Ticket Confirmed!</h2>
                        <p class="cb-sub">
                            ${cbEscape(subtitle)}
                        </p>
                        <div class="cb-reference">
                            Booking ID: ${safeReference}
                        </div>
                    </div>

                    ${details}

                    <div style="text-align:center;padding:18px 12px 8px">
                        <img
                            src="${qrUrl}"
                            alt="Booking QR Code"
                            style="width:120px;height:120px;background:white;padding:7px;border-radius:10px"
                        />
                        <p style="font-size:12px;color:#aaaabd;margin:8px 0">
                            Your CineBook booking QR
                        </p>
                    </div>

                    <div class="cb-actions" style="flex-wrap:wrap">
                        <button class="cb-btn cb-confirm"
                            data-download style="flex:1">
                            📥 Download E-Ticket PDF
                        </button>
                        <button class="cb-btn cb-cancel"
                            data-done style="flex:1">
                            Done ✓
                        </button>
                    </div>
                ` : `
                    <div class="cb-head">
                        <div class="cb-icon">${cbEscape(icon)}</div>
                        <h2 class="cb-title">${cbEscape(title)}</h2>
                        <p class="cb-sub">${cbEscape(subtitle)}</p>
                    </div>

                    ${details}

                    <div class="cb-actions" style="margin-top:18px">
                        <button class="cb-btn cb-cancel" data-cancel>
                            Go Back
                        </button>
                        <button class="cb-btn cb-confirm" data-confirm>
                            Confirm &amp; Book →
                        </button>
                    </div>
                `}
            </section>
        `;

        const cleanup = result => {
            document.removeEventListener("keydown", keyHandler);
            overlay.remove();
            resolve(result);
        };

        const keyHandler = event => {
            if (event.key === "Escape") cleanup(false);
        };

        overlay.addEventListener("click", event => {
            if (event.target === overlay) cleanup(false);
        });

        overlay.querySelector("[data-cancel]")
            ?.addEventListener("click", () => cleanup(false));

        overlay.querySelector("[data-confirm]")
            ?.addEventListener("click", () => cleanup(true));

        overlay.querySelector("[data-done]")
            ?.addEventListener("click", () => cleanup(true));

        overlay.querySelector("[data-download]")
            ?.addEventListener("click", () => {
                const printWindow = window.open("", "_blank");

                if (!printWindow) {
                    alert("PDF ke liye pop-ups allow karo, phir dobara try karo.");
                    return;
                }

                printWindow.document.write(`
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <title>CineBook E-Ticket</title>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                background: #f3f4f6;
                                padding: 25px;
                                color: #222;
                            }
                            .ticket {
                                max-width: 440px;
                                margin: auto;
                                padding: 25px;
                                background: white;
                                border: 2px dashed #dc254e;
                                border-radius: 18px;
                            }
                            h1 { color: #dc254e; }
                            .row {
                                display: flex;
                                justify-content: space-between;
                                gap: 15px;
                                padding: 12px 0;
                                border-bottom: 1px solid #eee;
                            }
                            .row strong { text-align: right; }
                            .qr { text-align: center; margin: 22px 0; }
                            .qr img { width: 140px; height: 140px; }
                            .total {
                                font-size: 22px;
                                color: #dc254e;
                                font-weight: bold;
                            }
                            @media print {
                                body { background: white; padding: 0; }
                                .ticket { border: 2px dashed #dc254e; }
                            }
                        </style>
                    </head>
                    <body>
                        <div class="ticket">
                            <h1>🎟️ CINEBOOK</h1>
                            <h2>E-Ticket Confirmed</h2>
                            <p>Booking ID: <strong>${safeReference}</strong></p>
                            <hr>
                            <div class="row">
                                <span>Movie</span><strong>${safeMovie}</strong>
                            </div>
                            <div class="row">
                                <span>Date</span><strong>${safeDate}</strong>
                            </div>
                            <div class="row">
                                <span>Showtime</span><strong>${safeTime}</strong>
                            </div>
                            <div class="row">
                                <span>Seats</span><strong>${safeSeats}</strong>
                            </div>
                            <div class="row">
                                <span>Total Amount</span>
                                <strong class="total">₹${safeTotal}</strong>
                            </div>
                            <div class="qr">
                                <img src="${qrUrl}" alt="Booking QR Code">
                                <p>Show this ticket at the cinema</p>
                            </div>
                            <p style="text-align:center">
                                Thank you for choosing CineBook 🍿
                            </p>
                        </div>
                        <script>
                            window.onload = function() {
                                setTimeout(function() {
                                    window.print();
                                }, 700);
                            };
                        <\/script>
                    </body>
                    </html>
                `);

                printWindow.document.close();
            });

        document.addEventListener("keydown", keyHandler);
        document.body.appendChild(overlay);

        overlay.querySelector(
            success ? "[data-download]" : "[data-confirm]"
        ).focus();
    });
}
// ========================================
// CONFIRM BOOKING
// ========================================
async function confirmBooking() {
    if (!currentMovie) {
        alert("Pehle movie select karo.");
        return;
    }

    if (selectedSeats.size === 0) {
        alert("Kam se kam ek seat select karo.");
        return;
    }

    const showDate = bookingDate.value;
    const displayTime = bookingShow.value;
    const showTime = timeMap[displayTime];

    if (!showDate || !showTime) {
        alert("Date aur show time check karo.");
        return;
    }

    const seats = [...selectedSeats].sort();
    const total = seats.length * currentPrice;

    // Attractive confirmation popup
    const confirmed = await cineBookPopup({
        title: "Ready for movie night?",
        subtitle: "Check your ticket details before confirming.",
        movie: currentMovie.title,
        date: showDate,
        time: displayTime,
        seats: seats.join(", "),
        count: seats.length,
        total
    });

    if (!confirmed) return;

    const button = document.querySelector(
        '#seatSection button[onclick="confirmBooking()"]'
    );

    if (button) {
        button.disabled = true;
        button.textContent = "Booking...";
    }

    try {
        const result = await apiRequest("/bookings", {
            method: "POST",
            body: JSON.stringify({
                movie_id: currentMovie.id,
                show_date: showDate,
                show_time: showTime,
                seats
            })
        });

        // Booking saved successfully; show custom success ticket.
        closeBooking();

        await cineBookPopup({
            title: "You're all booked!",
            subtitle: "Sit back, relax & enjoy your movie! 🍿",
            movie: result.movie,
            date: result.show_date,
            time: displayTime,
            seats: (result.seats || []).join(", "),
            total: result.total_amount,
            reference: result.booking_reference,
            success: true
        });

    } catch (error) {
        alert("Booking failed: " + error.message);

        if (error.message.toLowerCase().includes("seat")) {
            await openSeatSelection();
        }
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "Confirm Booking ✓";
        }
    }
}

window.confirmBooking = confirmBooking;
// ========================================
// MY BOOKINGS
// ========================================
async function viewMyBookings() {
    if (!(await checkLogin())) {
        alert("Apni bookings dekhne ke liye login karo.");
        showLogin();
        return;
    }

    try {
        const bookings = await apiRequest("/my-bookings");

        if (!Array.isArray(bookings) || bookings.length === 0) {
            alert("Abhi koi booking nahi hai.");
            return;
        }

        const text = bookings.map((booking) =>
            `${booking.movie_title}\n` +
            `Date: ${booking.show_date} | Time: ${booking.show_time}\n` +
            `Seat: ${booking.seat_code}\n` +
            `Amount: ₹${booking.total_amount}\n` +
            `Status: ${booking.status}`
        ).join("\n\n--------------------\n\n");

        alert("🎟️ MY BOOKINGS\n\n" + text);
    } catch (error) {
        alert("Bookings load nahi hui: " + error.message);
    }
}

window.viewMyBookings = viewMyBookings;

// ========================================
// INITIALIZE
// ========================================
filterMovies();
checkLogin();

console.log("CineBook JavaScript loaded successfully.");
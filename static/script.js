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
        alert("Pehle movie select karo.");
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
    const showTime = timeMap[bookingShow.value];

    if (!showDate || !showTime) {
        alert("Date aur show time check karo.");
        return;
    }

    const seats = [...selectedSeats].sort();
    const total = seats.length * currentPrice;

    const confirmed = confirm(
        `Movie: ${currentMovie.title}\n` +
        `Date: ${showDate}\n` +
        `Time: ${bookingShow.value}\n` +
        `Seats: ${seats.join(", ")}\n` +
        `Total: ₹${total}\n\n` +
        ` Are you ready to confirm your booking`
    );

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

        alert(
            "🎉 BOOKING CONFIRMED!\n\n" +
            `Booking ID: ${result.booking_reference}\n` +
            `Movie: ${result.movie}\n` +
            `Date: ${result.show_date}\n` +
            `Time: ${bookingShow.value}\n` +
            `Seats: ${result.seats.join(", ")}\n` +
            `Total: ₹${result.total_amount}\n\n` +
            '🍿 Sit back, relax & enjoy your movie!\n' +
             '✨ Thank you for choosing CineBook!'
        );

        closeBooking();
    } catch (error) {
        alert("Booking failed: " + error.message);

        // Kisi aur ne seat book kar li ho sakti hai.
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
const trips = {
  "Jeju Island": {
    country: "South Korea",
    season: "Summer",
    days: "2泊3日",
    memo: "海とごはんが最高だった"
  },

  "Hokkaido": {
    country: "Japan",
    season: "Summer",
    days: "2泊3日",
    memo: "積丹の海とウニを満喫"
  },

  "New York": {
    country: "USA",
    season: "Spring",
    days: "3泊4日",
    memo: "街歩きとグルメが楽しかった"
  }
};

const buttons = document.querySelectorAll(".trip-card button");
const tripDetail = document.querySelector("#trip-detail");

buttons.forEach(function(button) {
  button.addEventListener("click", function() {
    const tripName = button.dataset.trip;
    const trip = trips[tripName];

    tripDetail.innerHTML = `
      <h2>${tripName}</h2>
      <p>国：${trip.country}</p>
      <p>季節：${trip.season}</p>
      <p>日数：${trip.days}</p>
      <p>${trip.memo}</p>
    `;
  });
});
const filterButtons = document.querySelectorAll(".filters button");
const cards = document.querySelectorAll(".trip-card");
const searchBox = document.querySelector("#search-box");

let selectedCountry = "all";

function updateCards() {
  const searchText = searchBox.value.toLowerCase();

  cards.forEach(function(card) {
    const cardCountry = card.dataset.country;
    const title = card.querySelector("h2").textContent.toLowerCase();

    const matchesCountry =
      selectedCountry === "all" || selectedCountry === cardCountry;

    const matchesSearch =
      title.includes(searchText);

    if (matchesCountry && matchesSearch) {
      card.style.display = "block";
    } else {
      card.style.display = "none";
    }
  });
}

filterButtons.forEach(function(filterButton) {
  filterButton.addEventListener("click", function() {
    selectedCountry = filterButton.dataset.country;
    updateCards();
  });
});

searchBox.addEventListener("input", function() {
  updateCards();
});
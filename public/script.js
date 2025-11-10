const hamburger = document.getElementById("hamburger");
const navLinks = document.getElementById("nav-links");

hamburger.addEventListener("click", () => {
  navLinks.classList.toggle("show");
});
document.querySelectorAll(".cta-btn").forEach(btn => {
    btn.addEventListener("mouseover", () => {
        btn.style.transform = "scale(1.05)";
    });
    btn.addEventListener("mouseout", () => {
        btn.style.transform = "scale(1)";
    });
});

import puppeteer from "puppeteer";
import fs from "fs/promises";

const regionMap = new Map([
	["Москва и область", 0],
	["Санкт-Петербург и область", 1],
	["Владимирская обл.", 2],
	["Калужская обл.", 3],
	["Рязанская обл.", 4],
	["Тверская обл.", 5],
	["Тульская обл.", 6],
]);

(async () => {
	if (process.argv.length !== 4) {
		console.error("Usage: node script.js <productLink> <region>");
		process.exit(1);
	}

	const productLink = process.argv[2];
	const region = process.argv[3];
	const browser = await puppeteer.launch({ headless: true });
	const page = await browser.newPage();

	await page.setViewport({ width: 1920, height: 1080 });
	await page.goto(productLink);
	const baseRegion = ".UiHeaderHorizontalBase_region__2ODCG";

	await page.click(baseRegion);
	//await page.waitForTimeout(3000);

	// Нахожу список регионов
	const regionListSelector = ".UiRegionListBase_list__cH0fK";
	await page.waitForSelector(regionListSelector);

	const selectedRegionIndex = regionMap.get(region);
	const regionSelector = `${regionListSelector} li:nth-child(${
		selectedRegionIndex + 1
	})`;

	await page.click(regionSelector);

	await page.waitForTimeout(3000);
	const selectors = [
		{
			selector:
				".Price_price__QzA8L.Price_size_XL__MHvC1.Price_role_discount__l_tpE",
			name: "priceDiscount",
		},
		{
			selector:
				".Price_price__QzA8L.Price_size_XL__MHvC1.Price_role_regular__X6X4D",
			name: "priceRegular",
		},
	];

	const ratingSelector = ".Summary_reviewsContainer__qTWIu";
	const reviewCountSelector = ".Summary_reviewsCountContainer___aY6I";

	let prices = {};
	let rating = "";
	let reviewCount = 0;

	for (const { selector, name } of selectors) {
		try {
			prices[name] = (
				await page.$eval(selector, (element) => {
					return element.textContent.trim();
				})
			)
				.replace(/[^\d.,-]/g, "")
				.replace(",", ".");

			// Если найдено по первому селектору, ищe по третьему и записываю значение в priceOld
			if (name === "priceDiscount" && prices.priceDiscount) {
				const priceOldSelector =
					".Price_price__QzA8L.Price_size_XS__ESEhJ.Price_role_old__r1uT1";
				prices.priceOld = (
					await page.$eval(priceOldSelector, (element) => {
						return element.textContent.trim();
					})
				)
					.replace(/[^\d.,-]/g, "")
					.replace(",", ".");
			}

			break;
		} catch (error) {
			// Если не удалось найти элемент по текущему селектору, продолжаю искать
		}
	}

	try {
		rating = await page.$eval(ratingSelector, (element) => {
			return element.textContent.trim();
		});
	} catch (error) {
		console.error("Error finding rating:", error.message);
	}

	try {
		const rawReviewCount = await page.$eval(reviewCountSelector, (element) => {
			return element.textContent.trim();
		});

		// Привожу к целому числу, отбрасывая все символы, кроме цифр
		reviewCount = parseInt(rawReviewCount.replace(/[^\d]/g, ""), 10);
	} catch (error) {
		console.error("Error finding review count:", error.message);
	}

	let content = "";
	if (prices.priceDiscount) {
		content += `price=${prices.priceDiscount}\n`;
	}
	if (prices.priceRegular) {
		content += `price=${prices.priceRegular}\n`;
	}
	if (prices.priceOld) {
		content += `priceOld=${prices.priceOld}\n`;
	}
	if (rating) {
		content += `rating=${rating}\n`;
	}
	if (reviewCount) {
		content += `reviewCount=${reviewCount}`;
	}

	await fs.writeFile("product.txt", content);

	await page.screenshot({ path: "screenshot.jpg" });

	await browser.close();
})();

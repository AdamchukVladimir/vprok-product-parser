import puppeteer from "puppeteer";
import fs from "fs/promises";
import path from "path";

const productLinks = [
	"https://www.vprok.ru/product/domik-v-derevne-dom-v-der-moloko-ster-3-2-950g--309202",
	"https://www.vprok.ru/product/domik-v-derevne-dom-v-der-moloko-ster-2-5-950g--310778",
	"https://www.vprok.ru/product/makfa-makfa-izd-mak-spirali-450g--306739",
	"https://www.vprok.ru/product/greenfield-greenf-chay-gold-ceyl-bl-pak-100h2g--307403",
	"https://www.vprok.ru/product/chaykofskiy-chaykofskiy-sahar-pesok-krist-900g--308737",
	"https://www.vprok.ru/product/lavazza-kofe-lavazza-1kg-oro-zerno--450647",
	"https://www.vprok.ru/product/parmalat-parmal-moloko-pit-ulster-3-5-1l--306634",
	"https://www.vprok.ru/product/perekrestok-spmi-svinina-duhovaya-1kg--1131362",
	"https://www.vprok.ru/product/vinograd-kish-mish-1-kg--314623",
	"https://www.vprok.ru/product/eko-kultura-tomaty-cherri-konfetto-250g--946756",
	"https://www.vprok.ru/product/bio-perets-ramiro-1kg--476548",
	"https://www.vprok.ru/product/korkunov-kollektsiya-shokoladnyh-konfet-korkunov-iz-molochnogo-shokolada-s-fundukom-karamelizirovannym-gretskim-orehom-vafley-svetloy-orehovoy--1295690",
	"https://www.vprok.ru/product/picnic-picnic-batonchik-big-76g--311996",
	"https://www.vprok.ru/product/ritter-sport-rit-sport-shokol-tsel-les-oreh-mol-100g--305088",
	"https://www.vprok.ru/product/lays-chipsy-kartofelnye-lays-smetana-luk-140g--1197579",
];

const regionMap = new Map([
	["Москва и область", 0],
	["Санкт-Петербург и область", 1],
	["Владимирская обл.", 2],
	["Калужская обл.", 3],
	["Рязанская обл.", 4],
	["Тверская обл.", 5],
	["Тульская обл.", 6],
]);

const baseDir = "products";

async function createProductDirectory(region, productName) {
	// Формирую название папки до символа "-" и без спец символов
	const firstPart = productName.split("-")[0].trim();
	const cleanProductName = firstPart.replace(/[^\w\sа-яА-Я]/g, "");
	const sanitizedRegion = region.replace(/\./g, "_");

	const dirPath = path.join(baseDir, sanitizedRegion, cleanProductName);
	await fs.mkdir(dirPath, { recursive: true });
	return dirPath;
}

(async () => {
	const browser = await puppeteer.launch({ headless: true });
	for (const [region, regionIndex] of regionMap) {
		for (const link of productLinks) {
			const page = await browser.newPage();

			try {
				await page.setViewport({ width: 1920, height: 1080 });
				await page.goto(link);

				const productTitle = await page.title();
				const productDir = await createProductDirectory(region, productTitle);
				const baseRegion = ".UiHeaderHorizontalBase_region__2ODCG";

				await page.click(baseRegion);
				//await page.waitForTimeout(3000);

				// Нахожу список регионов
				const regionListSelector = ".UiRegionListBase_list__cH0fK";
				await page.waitForSelector(regionListSelector);

				// Выбираю дочерний элемент
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

						// Если найдено по первому селектору, ищем по третьему и записываю значение в priceOld
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
					const rawReviewCount = await page.$eval(
						reviewCountSelector,
						(element) => {
							return element.textContent.trim();
						}
					);

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

				await fs.writeFile(path.join(productDir, "product.txt"), content);
				await page.screenshot({
					path: path.join(productDir, "screenshot.jpg"),
				});
			} catch (error) {
				console.error("Error processing link:", link, error.message);
			} finally {
				// Закройте страницу после обработки
				await page.close();
			}
		}
	}

	// Закройте браузер после обработки всех ссылок
	await browser.close();
})();

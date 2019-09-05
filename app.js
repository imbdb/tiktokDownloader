require("dotenv").config();
const puppeteer = require('puppeteer');
const fs = require('fs');
const rp = require('request-promise-native');
const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
var path = require('path');

const downloadedVideosJson = './downloadedVideos.json';
const downloadDir = './videos';

const adapter = new FileSync(downloadedVideosJson);
const db = low(adapter)

db.defaults({ videos: [] })
  .write()

function processItemsObject(itemApiResponse) {
	console.log("Processing video information");
	let items = itemApiResponse.body.itemListData;
	for (var i = items.length - 1; i >= 0; i--) {
		if (db.get('videos').find({ id: items[i].itemInfos.id }).value() || db.get('videos').find({ url: items[i].itemInfos.video.urls[0] }).value()){
			console.log(`${items[i].itemInfos.id} is already downloaded. skipping...`);
		}else{
			downloadVideo(items[i]);
		}
		//console.log(items[i].itemInfos.video.urls[0])
	}
}

async function downloadVideo(item){
	let itemInfo = item.itemInfos;
	console.log('Starting download for ' + itemInfo.id);
	let video = await rp(itemInfo.video.urls[0],{'encoding':null});
	let savePath = path.join(downloadDir, `${itemInfo.id}.mp4`)
	fs.writeFileSync(savePath,video);
	await db.get('videos').push({
		id: itemInfo.id,
		url: itemInfo.video.urls[0]
	}).write();
	console.log(`Downloaded ${itemInfo.id} at ${savePath}`);
}

function checkDownloadDir() {
	if (!fs.existsSync(downloadDir)) {
		fs.mkdirSync(downloadDir);
	}
}

(async () => {
	checkDownloadDir();
	const browser = await puppeteer.launch();
	const page = await browser.newPage();
	page.on('response', async response => {
		if (response.url().startsWith("https://www.tiktok.com/share/item/list")) {
			processItemsObject(await response.json());
		}
	});
	console.log("Downloading Webpage");
	console.log("Waiting for video information...");
	await page.goto(process.env.TIKTOK_URL, { waitUntil: 'load', timeout: 0 });
	await browser.close();
})();
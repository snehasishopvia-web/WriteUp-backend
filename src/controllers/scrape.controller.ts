import { Request, Response } from "express";
import axios from "axios";
import metascraper from "metascraper";
import metascraperAuthor from "metascraper-author";
import metascraperDate from "metascraper-date";
import metascraperDescription from "metascraper-description";
import metascraperImage from "metascraper-image";
import metascraperLogo from "metascraper-logo";
import metascraperClearbit from "metascraper-clearbit";
import metascraperPublisher from "metascraper-publisher";
import metascraperTitle from "metascraper-title";
import metascraperUrl from "metascraper-url";
import metascraperReadability from "metascraper-readability";

const metascraperInstance = metascraper([
  metascraperAuthor(),
  metascraperDate(),
  metascraperDescription(),
  metascraperImage(),
  metascraperLogo(),
  metascraperClearbit(),
  metascraperPublisher(),
  metascraperTitle(),
  metascraperUrl(),
  metascraperReadability(),
]);

export const scrapeWebsite = async (req: Request, res: Response) => {
  const { url: targetUrl } = req.body;

  if (!targetUrl) {
    return res.status(400).send({ message: "URL is required" });
  }

  try {
    const response = await axios.get(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36",
      },
    });

    const metadata = await metascraperInstance({
      html: response.data,
      url: response.request?.responseURL || response.config.url,
    });
    return res.status(200).send(metadata);
  } catch (error) {
    console.error("Scraping error:", error);
    return res.status(500).send({ message: "Failed to scrape the website" });
  }
};

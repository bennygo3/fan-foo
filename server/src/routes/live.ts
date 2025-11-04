import express from "express";
import fetch from "node-fetch";

export const live = express.Router();

live.get("/")
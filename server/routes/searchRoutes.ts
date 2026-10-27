import express from "express";
import { searchSuggest } from "../controllers/searchSuggestController.js";

const SearchRouter = express.Router();

SearchRouter.get("/suggest", searchSuggest);

export default SearchRouter;
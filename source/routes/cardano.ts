/** source/routes/posts.ts */
import express from "express";
import controller from "../controllers/cardano";

const router = express.Router();

router.post('/cardano/mint', controller.mint);
router.post('/cardano/withdraw', controller.withdraw);

export = router;

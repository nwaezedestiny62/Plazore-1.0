import { Router } from 'express'
import { getProductAI } from '../controllers/aiController.js'
import { searchSuggest } from '../controllers/searchSuggestController.js'

const router = Router()

router.get('/product/:id', getProductAI)
router.get('/search-suggest', searchSuggest)

export default router
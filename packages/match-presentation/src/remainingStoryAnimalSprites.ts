import FLYING_STORY_ANIMAL_SPRITES from "./flyingStoryAnimalSprites.js"
import GROUND_STORY_ANIMAL_SPRITES from "./groundStoryAnimalSprites.js"
import SQUIRREL_AND_TIGER_SPRITES from "./squirrelAndTigerSprites.js"

const REMAINING_STORY_ANIMAL_SPRITES = Object.freeze({
  ...GROUND_STORY_ANIMAL_SPRITES,
  ...FLYING_STORY_ANIMAL_SPRITES,
  ...SQUIRREL_AND_TIGER_SPRITES,
})

export default REMAINING_STORY_ANIMAL_SPRITES

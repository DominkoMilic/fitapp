import { Redirect } from 'expo-router';

/** Old link: recipes are now created in the recipe editor. */
export default function NewRecipeRedirect() {
  return <Redirect href="/nutrition/recipe-edit" />;
}

import 'dotenv/config'
import Fastify from 'fastify'
import { submitForReview } from './submission.js'

const fastify = Fastify({
  logger: true,
})

// Configuration de l'API externe
const API_BASE_URL = 'https://api-ugi2pflmha-ew.a.run.app';
const API_KEY = process.env.API_KEY;

console.log(`API_KEY configurée: ${API_KEY}`);

// Stockage en mémoire pour les recettes
const recipesByCity = {}; // Format: { cityId: [{ id, content }, ...] }
let nextRecipeId = 1;

// Route GET /cities/:cityId/infos
fastify.get('/cities/:cityId/infos', async (request, reply) => {
  const { cityId } = request.params;
  console.log(`Requête d'informations pour la ville: ${cityId}`);
  
  try {
    // Vérifier si la ville existe
    console.log(`Vérification si la ville ${cityId} existe...`);
    const citiesResponse = await fetch(`${API_BASE_URL}/cities?apiKey=${API_KEY}`);
    
    if (!citiesResponse.ok) {
      console.error(`Erreur lors de la récupération des villes: ${citiesResponse.status}`);
      return reply.code(500).send({ error: "Erreur lors de la vérification de l'existence de la ville" });
    }
    
    const cities = await citiesResponse.json();
    console.log(`Nombre de villes récupérées: ${cities.length}`);
    
    const cityExists = cities.some(city => city.id === cityId);
    console.log(`La ville ${cityId} existe: ${cityExists}`);
    
    if (!cityExists) {
      console.log(`Ville non trouvée: ${cityId}`);
      return reply.code(404).send({ error: "Ville non trouvée" });
    }
    
    // Récupérer les informations détaillées de la ville
    console.log(`Récupération des détails pour la ville ${cityId}...`);
    const cityInfoResponse = await fetch(`${API_BASE_URL}/cities/${cityId}/insights?apiKey=${API_KEY}`);
    
    if (!cityInfoResponse.ok) {
      console.error(`Erreur lors de la récupération des informations de la ville: ${cityInfoResponse.status}`);
      return reply.code(500).send({ error: "Erreur lors de la récupération des informations de la ville" });
    }
    
    const cityInfo = await cityInfoResponse.json();
    console.log(`Informations récupérées pour ${cityId}: ${JSON.stringify(cityInfo)}`);
    
    // Récupérer les prévisions météo
    console.log(`Récupération des prévisions météo...`);
    const weatherResponse = await fetch(`${API_BASE_URL}/weather-predictions?apiKey=${API_KEY}`);
    
    if (!weatherResponse.ok) {
      console.error(`Erreur lors de la récupération des prévisions météo: ${weatherResponse.status}`);
      return reply.code(500).send({ error: "Erreur lors de la récupération des prévisions météo" });
    }
    
    const allWeatherData = await weatherResponse.json();
    console.log(`Données météo récupérées pour toutes les villes`);
    
    // Trouver les prévisions pour la ville spécifique
    const cityWeather = allWeatherData.find(item => item.cityId === cityId);
    
    if (!cityWeather) {
      console.error(`Données météo non trouvées pour la ville ${cityId}`);
      return reply.code(500).send({ error: "Prévisions météo non disponibles pour cette ville" });
    }
    
    // Formater les prévisions météo
    const weatherPredictions = cityWeather.predictions.map(prediction => ({
      when: prediction.when,
      min: prediction.min,
      max: prediction.max
    }));
    
    // Récupérer les recettes pour cette ville
    const recipes = recipesByCity[cityId] || [];
    console.log(`Recettes pour ${cityId}: ${recipes.length} trouvées`);
    
    // Transformer les coordonnées du format objet en tableau [lat, lon]
    const coordinates = [cityInfo.coordinates.latitude, cityInfo.coordinates.longitude];
    
    // Construire la réponse
    const response = {
      coordinates,
      population: cityInfo.population,
      knownFor: cityInfo.knownFor,
      weatherPredictions,
      recipes
    };
    
    console.log(`Réponse finale: ${JSON.stringify(response)}`);
    return reply.send(response);
  } catch (error) {
    console.error(`Erreur lors du traitement de la requête: ${error.message}`);
    console.error(error.stack);
    return reply.code(500).send({ error: "Erreur interne du serveur" });
  }
});

// Route POST /cities/:cityId/recipes
fastify.post('/cities/:cityId/recipes', async (request, reply) => {
  const { cityId } = request.params;
  const { content } = request.body || {};
  console.log(`Requête d'ajout de recette pour la ville ${cityId} avec contenu: ${content}`);
  
  try {
    // Vérifier si la ville existe
    const citiesResponse = await fetch(`${API_BASE_URL}/cities?apiKey=${API_KEY}`);
    
    if (!citiesResponse.ok) {
      console.error(`Erreur lors de la récupération des villes: ${citiesResponse.status}`);
      return reply.code(500).send({ error: "Erreur lors de la vérification de l'existence de la ville" });
    }
    
    const cities = await citiesResponse.json();
    const cityExists = cities.some(city => city.id === cityId);
    
    if (!cityExists) {
      console.log(`Ville non trouvée: ${cityId}`);
      return reply.code(404).send({ error: "Ville non trouvée" });
    }
    
    // Vérifier si le contenu est présent
    if (!content) {
      console.log("Recette sans contenu");
      return reply.code(400).send({ error: "Le contenu est requis" });
    }
    
    // Vérifier la longueur du contenu
    if (content.length < 10) {
      console.log(`Contenu trop court: ${content.length} caractères`);
      return reply.code(400).send({ error: "Le contenu est trop court (minimum 10 caractères)" });
    }
    
    if (content.length > 2000) {
      console.log(`Contenu trop long: ${content.length} caractères`);
      return reply.code(400).send({ error: "Le contenu est trop long (maximum 2000 caractères)" });
    }
    
    // Ajouter la recette
    if (!recipesByCity[cityId]) {
      recipesByCity[cityId] = [];
    }
    
    const recipe = {
      id: nextRecipeId++,
      content
    };
    
    recipesByCity[cityId].push(recipe);
    console.log(`Recette ajoutée pour ${cityId}: ${JSON.stringify(recipe)}`);
    
    // Renvoyer la recette créée avec un code 201
    return reply.code(201).send(recipe);
  } catch (error) {
    console.error(`Erreur lors du traitement de la requête POST: ${error.message}`);
    console.error(error.stack);
    return reply.code(500).send({ error: "Erreur interne du serveur" });
  }
});

// Route DELETE /cities/:cityId/recipes/:recipeId
fastify.delete('/cities/:cityId/recipes/:recipeId', async (request, reply) => {
  const { cityId, recipeId } = request.params;
  console.log(`Requête de suppression de la recette ${recipeId} pour la ville ${cityId}`);
  
  try {
    // Vérifier si la ville existe
    const citiesResponse = await fetch(`${API_BASE_URL}/cities?apiKey=${API_KEY}`);
    
    if (!citiesResponse.ok) {
      console.error(`Erreur lors de la récupération des villes: ${citiesResponse.status}`);
      return reply.code(500).send({ error: "Erreur lors de la vérification de l'existence de la ville" });
    }
    
    const cities = await citiesResponse.json();
    const cityExists = cities.some(city => city.id === cityId);
    
    if (!cityExists) {
      console.log(`Ville non trouvée: ${cityId}`);
      return reply.code(404).send({ error: "Ville non trouvée" });
    }
    
    // Convertir recipeId en entier
    const recipeIdInt = parseInt(recipeId, 10);
    
    // Vérifier si la recette existe
    if (!recipesByCity[cityId] || !recipesByCity[cityId].some(recipe => recipe.id === recipeIdInt)) {
      console.log(`Recette non trouvée: ${recipeId}`);
      return reply.code(404).send({ error: "Recette non trouvée" });
    }
    
    // Supprimer la recette
    recipesByCity[cityId] = recipesByCity[cityId].filter(recipe => recipe.id !== recipeIdInt);
    console.log(`Recette ${recipeId} supprimée pour la ville ${cityId}`);
    
    // Renvoyer un code 204 (No Content)
    return reply.code(204).send();
  } catch (error) {
    console.error(`Erreur lors du traitement de la requête DELETE: ${error.message}`);
    console.error(error.stack);
    return reply.code(500).send({ error: "Erreur interne du serveur" });
  }
});

// Configuration du support pour le JSON
fastify.addContentTypeParser('application/json', { parseAs: 'string' }, function (req, body, done) {
  try {
    const json = body.length > 0 ? JSON.parse(body) : {}
    done(null, json)
  } catch (err) {
    err.statusCode = 400
    done(err, undefined)
  }
})

fastify.listen(
  {
    port: process.env.PORT || 3000,
    host: process.env.RENDER_EXTERNAL_URL ? '0.0.0.0' : process.env.HOST || 'localhost',
  },
  function (err) {
    if (err) {
      fastify.log.error(err)
      process.exit(1)
    }

    console.log(`Serveur démarré sur le port ${process.env.PORT || 3000}`)
    
    //////////////////////////////////////////////////////////////////////
    // Don't delete this line, it is used to submit your API for review //
    // everytime your start your server.                                //
    //////////////////////////////////////////////////////////////////////
    submitForReview(fastify)
  }
)
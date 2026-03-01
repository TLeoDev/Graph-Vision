# 🕸️ Graph Vision — Visualisation d'Algorithmes

> Un outil pédagogique open-source pour visualiser et comprendre les structures de données et algorithmes de graphes de manière interactive.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://tleodev.github.io/Graph-Vision/)

## 📖 À propos

**Graph Vision** est un projet à **pédagogique** et **open source** conçu pour aider les étudiants, enseignants et curieux à visualiser le fonctionnement d'algorithmes de graphes et arbres.

L'objectif est de **rendre visibles les concepts invisibles** : rotations d'arbres, relaxation des arêtes dans Dijkstra, calcul des facteurs d'équilibre, etc. Chaque étape est animée en temps réel.

### ✨ Fonctionnalités actuelles

- 🌳 **Arbres AVL**
  - Insertion et suppression avec animations détaillées
  - Équilibrage automatique (rotations gauche/droite, double rotations)
  - Visualisation des hauteurs et facteurs d'équilibre
  - Génération aléatoire d'arbres
  - Construction depuis une liste de valeurs
  - Contrôle de la vitesse d'animation (×0.25 à ×5)

- 📍 **Algorithme de Dijkstra**
  - Visualisation étape par étape du plus court chemin
  - Tableau des distances en temps réel
  - Tableau détaillé des itérations (historique complet)
  - Construction interactive de graphes (ajout de nœuds et arêtes)
  - Génération aléatoire de graphes connexes
  - Animation des relaxations d'arêtes

## 🚀 Démonstration en ligne

Le projet est hébergé et accessible directement via GitHub Pages :

👉 **[Accéder à la démonstration (Live)](https://tleodev.github.io/Graph-Vision/)**

Aucune installation requise — tout fonctionne dans votre navigateur web. (Néanmoins pour le moment le projet n'est pas disponible sur navigateur mobile, toujours en cours de développement. Il faut l'utiliser sur pc uniquement.)
## 🛠️ Installation locale (optionnel)

Si vous souhaitez tester le code en local ou contribuer au projet :

### Prérequis

- Un navigateur web moderne (Chrome, Firefox, Safari, Edge)
- Aucune installation de dépendances nécessaire (Vanilla JavaScript)

### Étapes

1. **Cloner le dépôt :**
   ```bash
   git clone https://github.com/TLeoDev/Graph-Vision.git
   cd Graph-Vision
   ```

2. **Lancer l'application :**
   
   **Option 1** — Ouvrir directement le fichier HTML :
   ```bash
   # Ouvrir index.html dans votre navigateur
   open index.html  # macOS
   start index.html # Windows
   xdg-open index.html # Linux
   ```
   
   **Option 2** — Utiliser un serveur HTTP local (recommandé) :
   ```bash
   # Avec Python 3
   python3 -m http.server 8000
   
   # Avec Node.js (si npx est installé)
   npx serve
   
   # Avec l'extension VS Code "Live Server"
   # Clic droit sur index.html → "Open with Live Server"
   ```
   
   Puis ouvrir [http://localhost:8000](http://localhost:8000) dans votre navigateur.

3. **Naviguer dans l'application :**
   - `index.html` → Visualisation des Arbres AVL
   - `dijkstra.html` → Visualisation de l'algorithme de Dijkstra

## 📚 Guide d'utilisation

### Arbres AVL

1. **Insérer des valeurs** : Tapez un nombre et cliquez sur `＋`
2. **Supprimer** : Tapez la valeur à supprimer et cliquez sur `✕`
3. **Construire depuis une liste** : Entrez plusieurs valeurs séparées par des virgules (ex: `5, 3, 8, 1, 4`)
4. **Générer aléatoirement** : Entrez un nombre de nœuds (max 100) et cliquez sur `🎲`
5. **Contrôler la vitesse** : Utilisez les boutons `×0.25` à `×5` pour ralentir ou accélérer les animations

### Dijkstra

1. **Mode Nœud** : Cliquez dans le vide pour placer un nœud
2. **Mode Arête** : Cliquez sur deux nœuds successivement pour créer une arête (le poids vous sera demandé)
3. **Mode Déplacer** : Glissez-déposez les nœuds pour réorganiser le graphe
4. **Mode Suppr.** : Cliquez sur un nœud pour le supprimer
5. **Lancer Dijkstra** : Entrez le nœud de départ et d'arrivée, puis cliquez sur `▶ Lancer Dijkstra`
6. **Tableau détaillé** : Cliquez sur l'icône 👁 dans le tableau des distances pour voir l'historique complet des itérations

## 💻 Technologies utilisées

- **HTML5 & CSS3** — Interface moderne et responsive
- **JavaScript (ES6+)** — Logique des algorithmes et manipulation DOM
- **SVG** — Rendu vectoriel des graphes et animations fluides
- **Aucune dépendance externe** — Projet 100% Vanilla JS

## 🎯 Objectifs pédagogiques

Ce projet vise à faciliter la compréhension de :
- Les propriétés des arbres AVL (équilibrage, rotations)
- L'algorithme de Dijkstra (relaxation, file de priorité)
- La complexité temporelle des opérations
- La visualisation pas-à-pas des algorithmes

## 👥 Auteurs

Projet réalisé par :
- **Léo TUAILLON** — [@TLeoDev](https://github.com/TLeoDev)
- **Léo Condat** — [@leocdt](https://github.com/leocdt)
- **Jimmy Legg** — [@jimmy-legg](https://github.com/jimmy-legg)

## 📄 Licence

Ce projet est sous licence **MIT**. Vous êtes libre de l'utiliser, le modifier et le distribuer à des fins éducatives, personnelles ou commerciales.

Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🤝 Contributions

Les contributions sont les bienvenues ! N'hésitez pas à :
- Signaler des bugs via les [Issues](https://github.com/TLeoDev/Graph-Vision/issues)
- Proposer de nouvelles fonctionnalités
- Améliorer la documentation

## 🔮 Roadmap

Fonctionnalités prévues :
- 🔄 Parcours BFS / DFS
- 📊 Tas binaires (Min/Max Heap)
- 🌲 Arbres Rouges-Noirs
- 📈 Algorithme de Kruskal (arbres couvrants)

---


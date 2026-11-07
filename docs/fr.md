# Risque d'orages violents (SPC)

Les perspectives convectives du **Storm Prediction Center** (SPC) de la NOAA chez vous, dans Gladys : la catégorie
de risque d'orages violents pour aujourd'hui, demain et après-demain, et les probabilités de tornade, de grêle et de
rafales destructrices d'aujourd'hui et de demain. Avec des déclencheurs de scène et un widget de tableau de bord.

> **Pas un service d'alerte officiel.** Les perspectives sont des prévisions des jours à venir. Pour les vigilances
> et avertissements en cours, suivez le National Weather Service (l'intégration
> [National Weather Service](https://github.com/William-De71/gladys-national-weather-service) les amène dans
> Gladys), une radio NOAA Weather Radio et vos autorités locales.

Non affiliée à la NOAA ni au National Weather Service.

## Ce que vous obtenez

- **Un appareil par maison** de Gladys située aux États-Unis contigus.
- La **catégorie SPC** d'aujourd'hui, de demain et d'après-demain : 0 (aucun risque d'orage violent, ou orages
  ordinaires seulement), 1 Marginal, 2 Faible (Slight), 3 Accru (Enhanced), 4 Modéré (Moderate), 5 Élevé (High).
- La **probabilité** (%) d'une tornade, de grêle d'au moins 2,5 cm et de rafales d'au moins 93 km/h à moins de
  40 km (25 miles) de la maison, aujourd'hui et demain ; pour après-demain, la probabilité d'un orage violent
  quelconque.
- Le **groupe d'intensité conditionnelle** (0 à 3) de chaque phénomène : plus il est haut, plus les orages
  pourraient être intenses (fortes tornades, très gros grêlons, rafales destructrices). Il remplace depuis 2026 les
  zones hachurées « significatives ».
- Une phrase de **résumé**, par exemple « Risque faible d'orages violents aujourd'hui (tornade 5 %, grêle 15 %,
  rafales 15 %) ; demain : 3 · Accru ».
- Trois **déclencheurs de scène** et un **widget de tableau de bord**.

## Prérequis

- Gladys Assistant 5.3.0 ou plus récent.
- La **position de votre maison** renseignée dans Gladys (Paramètres → Maisons), aux États-Unis contigus. L'Alaska,
  Hawaï, Porto Rico et les autres pays ne sont pas couverts par le SPC.
- Un accès à Internet depuis Gladys. Ni compte, ni clé.

## Configuration

### Réglages

| Réglage                            | Défaut   | Rôle                                                                               |
| ---------------------------------- | -------- | ---------------------------------------------------------------------------------- |
| Langue des noms de fonctionnalités | Français | Noms des fonctionnalités des nouveaux appareils, langue du résumé et des variables |

À l'installation, l'intégration demande la **position de vos maisons** : elle lit leurs coordonnées dans Gladys et
vérifie les zones du SPC **dans le conteneur**. Votre position n'est envoyée à personne. Ouvrez ensuite l'onglet
**Découverte** de l'intégration et créez l'appareil de votre maison. Une maison ajoutée ou déplacée plus tard
apparaît après une nouvelle recherche dans l'onglet Découverte.

## Appareils

| Fonctionnalité                                  | Type   | Valeur                                                |
| ----------------------------------------------- | ------ | ----------------------------------------------------- |
| Risque orageux aujourd'hui / demain / dans 2 j. | nombre | Catégorie SPC, de 0 à 5                               |
| Probabilité de tornade / de grêle / de rafales  | %      | Aujourd'hui et demain, à moins de 40 km               |
| Orage violent dans 2 jours                      | %      | Tout orage violent, après-demain                      |
| Intensité … (groupe)                            | nombre | Groupe d'intensité conditionnelle du phénomène, 0 à 3 |
| Résumé du risque orageux                        | texte  | Phrase de résumé, dans la langue des réglages         |

Les catégories sont des nombres (et non la pastille « risque » de Gladys, qui ne connaît que quatre niveaux) : une
condition de scène comme « risque aujourd'hui ≥ 2 » fonctionne. « Aujourd'hui » est la journée convective du SPC, de
12 h UTC à 12 h UTC le lendemain matin. Quand le SPC ne répond pas, rien n'est publié : les dernières valeurs
vieillissent simplement.

## Widget de tableau de bord

**Risque d'orages violents** : pour la maison choisie (la première sinon), une ligne par jour avec sa catégorie,
colorée d'après l'échelle du SPC autant que la palette de Gladys le permet (vert Marginal, jaune Faible et Accru,
rouge Modéré et Élevé, bleu pour les orages ordinaires), un titre à partir de Faible, les probabilités de tornade /
grêle / rafales d'aujourd'hui et de demain (avec le plus haut groupe d'intensité, « CIG2 »), l'heure d'émission et un
bouton vers les perspectives du SPC. Les probabilités et le bouton ont chacun un réglage pour les masquer.

## Déclencheurs de scène

- **Le risque d'orages violents atteint une catégorie** : une nouvelle perspective porte la catégorie d'un jour au
  niveau choisi (1 à 5) ou au-delà, une fois, au franchissement à la hausse. Filtres : maison, jour (aujourd'hui,
  demain, dans 2 jours).
- **Risque d'orages violents relevé** : une nouvelle perspective relève la catégorie d'un jour déjà prévu, quel que
  soit le niveau.
- **La probabilité de tornade atteint un seuil** : la probabilité de tornade d'aujourd'hui ou de demain atteint le
  seuil choisi (2 à 60 %).

Le même jour du calendrier est suivi d'une perspective à l'autre : quand le jour 3 annonçait déjà Accru, le jour 2
qui le confirme ne déclenche rien. Variables : maison, jour, date, catégorie et son nom, résumé ; la catégorie
précédente pour un relèvement ; la probabilité et le groupe d'intensité pour une tornade. Les toutes premières
perspectives lues après l'installation ne servent que de référence : elles ne déclenchent rien.

## Exemples de scènes

- Quand le risque de demain atteint Faible, envoyer « Risque {{level_name}} d'orages violents demain » à la famille.
- Quand la probabilité de tornade d'aujourd'hui atteint 10 %, passer la lumière du couloir en orange et envoyer un
  message.
- Chaque matin à 7 h, si le risque du jour vaut 3 ou plus, lire le résumé à voix haute.

## Sources des données, licence et quotas

- [Perspectives convectives du SPC](https://www.spc.noaa.gov/products/outlook/), NOAA / National Weather Service,
  domaine public (œuvre du gouvernement américain). Lues toutes les 15 minutes : onze petits fichiers GeoJSON, en
  requêtes conditionnelles, si bien qu'un fichier inchangé depuis le cycle précédent coûte une réponse 304 sans
  contenu. Le SPC émet la perspective du jour 1 cinq fois par jour, celle du jour 2 deux fois et celle du jour 3 une
  ou deux fois.

## Dépannage

- **« Aucune maison de Gladys n'a de position »** : renseignez la position de votre maison dans Paramètres →
  Maisons, puis relancez la recherche dans l'onglet Découverte.
- **« Aucune maison n'est dans les États-Unis contigus »** : le SPC ne couvre que les 48 États contigus.
- L'état de connexion indique que les perspectives sont illisibles : le site du SPC est injoignable. Rien n'est
  publié tant qu'il ne répond pas, nouvel essai toutes les 15 minutes.

## Limites

- Une prévision des jours à venir, pas une alerte : des orages peuvent se former hors des zones tracées par le SPC.
- Développée sans journée d'orages violents en cours : les tests utilisent les vraies perspectives du 27 avril 2026
  (risque modéré) et du 7 novembre 2026. Vos retours sont les bienvenus.
- La probabilité d'un phénomène porte sur 40 km autour de la maison, comme le SPC la définit, pas sur la maison
  elle-même.

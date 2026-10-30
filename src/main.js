// HEADS Rescate Dorado — entry point. Styles in the original cascade order, then the game.
import './styles/00-base.css';
import './styles/01-end-plate.css';
import './styles/02-menu-pc.css';
import './styles/03-extra-power.css';
import './styles/04-language.css';
import './styles/05-hud-movil.css';
import './styles/06-hud-pc.css';
import './styles/07-tutorial-movil.css';
// v62: phone HUD (Santi's design) and its font, bundled so it works without internet
import '@fontsource/saira-condensed/latin-600.css';
import '@fontsource/saira-condensed/latin-700.css';
import '@fontsource/saira-condensed/latin-800.css';
import './hud/hud.js';
import 'virtual:heads-game'; // src/game/*.js joined in file-name order (one shared scope, exactly as the original single file)

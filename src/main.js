// HEADS Rescate Dorado — entry point. Styles in the original cascade order, then the game.
import './styles/00-base.css';
import './styles/01-end-plate.css';
import './styles/02-menu-pc.css';
import './styles/03-extra-power.css';
import './styles/04-language.css';
import 'virtual:heads-game'; // src/game/*.js joined in file-name order (one shared scope, exactly as the original single file)

// src/headlines.js
const headlines = {
  0: [
    {
      text: 'An enormous gold asteroid has crashed into Australian desert',
      effects: [{ commodity: 'Gold', change: 'down', impact: 'supply_up' }],
    },
    {
      text: 'New gas reserves have been found in Eastern Europe',
      effects: [{ commodity: 'Natural Gas', change: 'down', impact: 'supply_up' }],
    },
    {
      text: 'The civil war in Iran has ended following peace talks.',
      effects: [{ commodity: 'Crude Oil', change: 'down', impact: 'supply_up' }],
    },
    {
      text: 'Amazing wheat harvests have been reported in Western Africa.',
      effects: [{ commodity: 'Wheat', change: 'down', impact: 'supply_up' }],
    },
    {
      text: 'Bird flu cases have been recorded in Thailand',
      effects: [{ commodity: 'Chicken', change: 'down', impact: 'demand_down' }],
    },
    {
      text: 'Indonesian forest fires have devastated Palm plantations.',
      effects: [{ commodity: 'Palm oil', change: 'up', impact: 'supply_down' }],
    },
    {
      text: 'Tropical Storm Mindy has turned towards Haiti',
      effects: [{ commodity: 'Sugar', change: 'up', impact: 'supply_down' }],
    },
    {
      text: 'Eco-terrorists have sunk a cargo ship full of soya',
      effects: [{ commodity: 'Soya bean', change: 'up', impact: 'supply_down' }],
    },
  ],
  1: [
    {
      text: 'OPEC has agreed to increase output by 5%',
      effects: [{ commodity: 'Crude Oil', change: 'down', impact: 'supply_up' }],
    },
    {
      text: 'New gas reserves have been found in Northern Africa',
      effects: [{ commodity: 'Natural Gas', change: 'down', impact: 'supply_up' }],
    },
    {
      text: 'China has reported record Soya harvest',
      effects: [{ commodity: 'Soya bean', change: 'down', impact: 'supply_up' }],
    },
    {
      text: 'Amazing corn harvests have been reported in Argentina and India.',
      effects: [{ commodity: 'Corn', change: 'down', impact: 'supply_up' }],
    },
    {
      text: 'New wheat-threatening fungus has been discovered',
      effects: [{ commodity: 'Wheat', change: 'up', impact: 'supply_down' }],
    },
    {
      text: 'Scientists have discovered link between Soya and cancer',
      effects: [{ commodity: 'Soya bean', change: 'down', impact: 'demand_down' }],
    },
    {
      text: 'Tech-billionaire has tweeted about new battery using caffeine molecule',
      effects: [{ commodity: 'Coffee', change: 'up', impact: 'demand_up' }],
    },
    {
      text: '80% of Soya cargo has been salvaged.',
      effects: [{ commodity: 'Soya bean', change: 'down', impact: 'supply_up' }],
    },
    {
      text: 'EU has banned Asian poultry imports',
      effects: [{ commodity: 'Chicken', change: 'up', impact: 'supply_down' }],
    },
    {
      text: 'China has stopped buying Aluminium',
      effects: [{ commodity: 'Aluminium', change: 'down', impact: 'demand_down' }],
    },
    {
      text: 'Two American Aluminium plants have opened on West coast.',
      effects: [{ commodity: 'Aluminium', change: 'down', impact: 'supply_up' }],
    },
  ],
  2: [
    {
      text: 'New gas reserves have been found in Southern Europe',
      effects: [{ commodity: 'Natural Gas', change: 'down', impact: 'supply_up' }],
    },
    {
      text: 'UN has lifted sanctions on Yemen',
      effects: [{ commodity: 'Crude Oil', change: 'down', impact: 'supply_up' }],
    },
    {
      text: 'Even more amazing corn harvests have been reported in Argentina and India.',
      effects: [{ commodity: 'Corn', change: 'down', impact: 'supply_up' }],
    },
    {
      text: 'New fungus-resistant wheat has been genetically engineered',
      effects: [{ commodity: 'Wheat', change: 'down', impact: 'supply_up' }],
    },
    {
      text: 'Soya - cancer theory has been discredited',
      effects: [{ commodity: 'Soya bean', change: 'up', impact: 'demand_up' }],
    },
    {
      text: 'East African sugar mite has spread to Jamaica',
      effects: [{ commodity: 'Sugar', change: 'up', impact: 'supply_down' }],
    },
    {
      text: 'Mysterious sheep disease has spread across New Zealand',
      effects: [{ commodity: 'Wool', change: 'up', impact: 'supply_down' }],
    },
    {
      text: 'Tech-billionaire has admitted that caffeine battery was a joke.',
      effects: [{ commodity: 'Coffee', change: 'down', impact: 'demand_down' }],
    },
    {
      text: 'China has stopped buying steel',
      effects: [{ commodity: 'Recycled Steel', change: 'down', impact: 'demand_down' }],
    },
    {
      text: 'New, low-cost, aluminium-replacing alloy has been invented',
      effects: [{ commodity: 'Aluminium', change: 'down', impact: 'demand_down' }],
    },
    {
      text: 'Record high temperatures have been recorded in Europe',
      effects: [{ commodity: 'Natural Gas', change: 'down', impact: 'demand_down' }],
    },
  ],
  3: [
    {
      text: 'Russia and China have agreed a new pipeline project for Gas',
      effects: [{ commodity: 'Natural Gas', change: 'down', impact: 'supply_up' }],
    },
    {
      text: 'Apple has announced plans for new hydrogen powered car',
      effects: [{ commodity: 'Crude Oil', change: 'down', impact: 'demand_down' }],
    },
    {
      text: 'Scientists have suggested link between caffeine and alziemers',
      effects: [{ commodity: 'Coffee', change: 'down', impact: 'demand_down' }],
    },
    {
      text: 'A new documentary has exposed the environmental damage caused by soya farming in Brazil',
      effects: [{ commodity: 'Soya bean', change: 'down', impact: 'demand_down' }],
    },
    {
      text: 'Trials of sheep medicine have been successful',
      effects: [{ commodity: 'Wool', change: 'down', impact: 'supply_up' }],
    },
    {
      text: 'A new super-llama has been cloned from ancient mayan blanket fibres',
      effects: [{ commodity: 'Wool', change: 'down', impact: 'supply_up' }],
    },
    {
      text: 'An ancient Hindu text has been discovered advocating beef consumption',
      effects: [{ commodity: 'Beef', change: 'up', impact: 'demand_up' }],
    },
    {
      text: 'Australia has reported bumper Wheat harvests',
      effects: [{ commodity: 'Wheat', change: 'down', impact: 'supply_up' }],
    },
  ],
  4: [
    {
      text: 'Internet celebrities have begun promoting a new Bread-only-diet ',
      effects: [{ commodity: 'Wheat', change: 'up', impact: 'demand_up' }],
    },
    {
      text: 'European Union has announced subsidies for electric boilers',
      effects: [{ commodity: 'Natural Gas', change: 'down', impact: 'demand_down' }],
    },
    {
      text: 'US Fracking has reported record production',
      effects: [{ commodity: 'Natural Gas', change: 'down', impact: 'supply_up' }],
    },
    {
      text: 'European Union has agreed trade embargo on Saudia Arabia',
      effects: [{ commodity: 'Crude Oil', change: 'up', impact: 'supply_down' }],
    },
    {
      text: 'Venezuela has cut oil production',
      effects: [{ commodity: 'Crude Oil', change: 'up', impact: 'supply_down' }],
    },
    {
      text: 'China has pledged to build 25 new warships over next three years',
      effects: [{ commodity: 'Recycled Steel', change: 'up', impact: 'demand_up' }],
    },
    {
      text: 'A second study has confirmed caffeine - brain damage link',
      effects: [{ commodity: 'Coffee', change: 'down', impact: 'demand_down' }],
    },
    {
      text: 'Brazil has closed 4 ethanol production plants as gas prices continue to tumble',
      effects: [{ commodity: 'Sugar', change: 'down', impact: 'demand_down' }],
    },
    {
      text: 'Hindu text has been exposed as a fake',
      effects: [{ commodity: 'Beef', change: 'down', impact: 'demand_down' }],
    },
    {
      text: 'Super llama has died',
      effects: [{ commodity: 'Wool', change: 'up', impact: 'supply_down' }],
    },
    {
      text: 'India has announced extensive infrastructure plans',
      effects: [{ commodity: 'Recycled Steel', change: 'up', impact: 'demand_up' }],
    },
  ],
  5: [
    {
      text: 'Crypto market instability has pushed investors to more traditional investments',
      effects: [{ commodity: 'Gold', change: 'up', impact: 'demand_up' }],
    },
    {
      text: 'more influencers have begun promoting Bread-only-diet',
      effects: [{ commodity: 'Wheat', change: 'up', impact: 'demand_up' }],
    },
    {
      text: 'new technology has successfully removed carcinogen from coffee',
      effects: [{ commodity: 'Coffee', change: 'up', impact: 'demand_up' }],
    },
    {
      text: 'European Union has removed trade embargo on Saudia Arabia',
      effects: [{ commodity: 'Crude Oil', change: 'down', impact: 'supply_up' }],
    },
    {
      text: 'Russia has increased oil production',
      effects: [{ commodity: 'Crude Oil', change: 'down', impact: 'supply_up' }],
    },
    {
      text: 'Brazil has tripled export taxes on Soya',
      effects: [{ commodity: 'Soya bean', change: 'up', impact: 'supply_down' }],
    },
    {
      text: 'new restrictions on intensive cattle farming have been announced in Argentina',
      effects: [{ commodity: 'Beef', change: 'up', impact: 'supply_down' }],
    },
    {
      text: 'Australian sheerers have announced 30-day strike',
      effects: [{ commodity: 'Wool', change: 'up', impact: 'supply_down' }],
    },
    {
      text: 'Indian cotton farmers have reported a plague of bollworms',
      effects: [{ commodity: 'Cotton', change: 'up', impact: 'supply_down' }],
    },
  ],
};

export default headlines;
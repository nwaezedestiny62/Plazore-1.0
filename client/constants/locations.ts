export type LocationCountry = {
  code: string
  name: string
  states: {
    code: string
    name: string
    cities: string[]
  }[]
}

/**
 * Fulfillment geo data — aligned with marketplace regions in regions.ts
 * NG · GH · BJ · CM · KE · ZA · EG · US · CA · GB · DE · FR · AU
 */
export const FULFILLMENT_COUNTRIES: LocationCountry[] = [
  // ── Nigeria ──────────────────────────────────────────
  {
    code: 'NG',
    name: 'Nigeria',
    states: [
      {
        code: 'AB',
        name: 'Abia',
        cities: ['Umuahia', 'Aba', 'Arochukwu', 'Ohafia'],
      },
      {
        code: 'AD',
        name: 'Adamawa',
        cities: ['Yola', 'Mubi', 'Jimeta', 'Numan'],
      },
      {
        code: 'AK',
        name: 'Akwa Ibom',
        cities: ['Uyo', 'Eket', 'Ikot Ekpene', 'Oron'],
      },
      {
        code: 'AN',
        name: 'Anambra',
        cities: ['Awka', 'Onitsha', 'Nnewi', 'Ekwulobia', 'Ihiala'],
      },
      {
        code: 'BA',
        name: 'Bauchi',
        cities: ['Bauchi', 'Azare', 'Misau', 'Jama’are'],
      },
      {
        code: 'BY',
        name: 'Bayelsa',
        cities: ['Yenagoa', 'Brass', 'Ogbia', 'Sagbama'],
      },
      {
        code: 'BE',
        name: 'Benue',
        cities: ['Makurdi', 'Gboko', 'Otukpo', 'Katsina-Ala'],
      },
      {
        code: 'BO',
        name: 'Borno',
        cities: ['Maiduguri', 'Biu', 'Bama', 'Dikwa'],
      },
      {
        code: 'CR',
        name: 'Cross River',
        cities: ['Calabar', 'Ikom', 'Ogoja', 'Obudu'],
      },
      {
        code: 'DE',
        name: 'Delta',
        cities: ['Asaba', 'Warri', 'Sapele', 'Ughelli', 'Agbor'],
      },
      {
        code: 'EB',
        name: 'Ebonyi',
        cities: ['Abakaliki', 'Afikpo', 'Onueke'],
      },
      {
        code: 'ED',
        name: 'Edo',
        cities: ['Benin City', 'Auchi', 'Ekpoma', 'Uromi'],
      },
      {
        code: 'EK',
        name: 'Ekiti',
        cities: ['Ado-Ekiti', 'Ikere', 'Ilawe', 'Oye'],
      },
      {
        code: 'EN',
        name: 'Enugu',
        cities: ['Enugu', 'Nsukka', 'Awgu', 'Oji River'],
      },
      {
        code: 'FC',
        name: 'FCT',
        cities: [
          'Abuja',
          'Gwarinpa',
          'Wuse',
          'Maitama',
          'Asokoro',
          'Garki',
          'Kubwa',
          'Lugbe',
          'Nyanya',
          'Karu',
        ],
      },
      {
        code: 'GO',
        name: 'Gombe',
        cities: ['Gombe', 'Kaltungo', 'Billiri'],
      },
      {
        code: 'IM',
        name: 'Imo',
        cities: ['Owerri', 'Orlu', 'Okigwe', 'Mbaise'],
      },
      {
        code: 'JI',
        name: 'Jigawa',
        cities: ['Dutse', 'Hadejia', 'Birnin Kudu'],
      },
      {
        code: 'KD',
        name: 'Kaduna',
        cities: ['Kaduna', 'Zaria', 'Kafanchan', 'Kagoro'],
      },
      {
        code: 'KN',
        name: 'Kano',
        cities: ['Kano', 'Wudil', 'Bichi', 'Rano', 'Gwarzo'],
      },
      {
        code: 'KT',
        name: 'Katsina',
        cities: ['Katsina', 'Daura', 'Funtua', 'Malumfashi'],
      },
      {
        code: 'KE',
        name: 'Kebbi',
        cities: ['Birnin Kebbi', 'Argungu', 'Yauri'],
      },
      {
        code: 'KO',
        name: 'Kogi',
        cities: ['Lokoja', 'Okene', 'Idah', 'Kabba'],
      },
      {
        code: 'KW',
        name: 'Kwara',
        cities: ['Ilorin', 'Offa', 'Jebba', 'Omu-Aran'],
      },
      {
        code: 'LA',
        name: 'Lagos',
        cities: [
          'Lagos Island',
          'Ikeja',
          'Lekki',
          'Victoria Island',
          'Ikoyi',
          'Surulere',
          'Yaba',
          'Ajah',
          'Ikorodu',
          'Badagry',
          'Epe',
          'Agege',
          'Mushin',
          'Alimosho',
          'Apapa',
          'Festac',
          'Maryland',
          'Gbagada',
          'Ojota',
          'Magodo',
        ],
      },
      {
        code: 'NA',
        name: 'Nasarawa',
        cities: ['Lafia', 'Keffi', 'Akwanga', 'Nasarawa'],
      },
      {
        code: 'NI',
        name: 'Niger',
        cities: ['Minna', 'Bida', 'Suleja', 'Kontagora'],
      },
      {
        code: 'OG',
        name: 'Ogun',
        cities: ['Abeokuta', 'Ijebu-Ode', 'Sagamu', 'Ota', 'Ilaro'],
      },
      {
        code: 'ON',
        name: 'Ondo',
        cities: ['Akure', 'Ondo', 'Owo', 'Ikare'],
      },
      {
        code: 'OS',
        name: 'Osun',
        cities: ['Osogbo', 'Ile-Ife', 'Ilesa', 'Ede'],
      },
      {
        code: 'OY',
        name: 'Oyo',
        cities: ['Ibadan', 'Ogbomosho', 'Oyo', 'Iseyin', 'Saki'],
      },
      {
        code: 'PL',
        name: 'Plateau',
        cities: ['Jos', 'Bukuru', 'Pankshin', 'Shendam'],
      },
      {
        code: 'RI',
        name: 'Rivers',
        cities: [
          'Port Harcourt',
          'Obio-Akpor',
          'Bonny',
          'Eleme',
          'Okrika',
          'Ahoada',
        ],
      },
      {
        code: 'SO',
        name: 'Sokoto',
        cities: ['Sokoto', 'Tambuwal', 'Wurno'],
      },
      {
        code: 'TA',
        name: 'Taraba',
        cities: ['Jalingo', 'Wukari', 'Bali'],
      },
      {
        code: 'YO',
        name: 'Yobe',
        cities: ['Damaturu', 'Potiskum', 'Gashua'],
      },
      {
        code: 'ZA',
        name: 'Zamfara',
        cities: ['Gusau', 'Kaura Namoda', 'Talata Mafara'],
      },
    ],
  },

  // ── Ghana ────────────────────────────────────────────
  {
    code: 'GH',
    name: 'Ghana',
    states: [
      {
        code: 'AF',
        name: 'Ahafo',
        cities: ['Goaso', 'Bechem'],
      },
      {
        code: 'AH',
        name: 'Ashanti',
        cities: ['Kumasi', 'Obuasi', 'Ejisu', 'Konongo', 'Mampong'],
      },
      {
        code: 'BO',
        name: 'Bono',
        cities: ['Sunyani', 'Berekum', 'Dormaa Ahenkro'],
      },
      {
        code: 'BE',
        name: 'Bono East',
        cities: ['Techiman', 'Kintampo', 'Nkoranza'],
      },
      {
        code: 'CP',
        name: 'Central',
        cities: ['Cape Coast', 'Winneba', 'Kasoa', 'Elmina'],
      },
      {
        code: 'EP',
        name: 'Eastern',
        cities: ['Koforidua', 'Nkawkaw', 'Akim Oda', 'Suhum'],
      },
      {
        code: 'GA',
        name: 'Greater Accra',
        cities: [
          'Accra',
          'Tema',
          'Madina',
          'Ashaiman',
          'Teshie',
          'Nungua',
          'Dansoman',
          'Legon',
          'Spintex',
          'East Legon',
        ],
      },
      {
        code: 'NE',
        name: 'North East',
        cities: ['Nalerigu', 'Walewale'],
      },
      {
        code: 'NP',
        name: 'Northern',
        cities: ['Tamale', 'Yendi', 'Savelugu'],
      },
      {
        code: 'OT',
        name: 'Oti',
        cities: ['Dambai', 'Jasikan', 'Kadjebi'],
      },
      {
        code: 'SV',
        name: 'Savannah',
        cities: ['Damongo', 'Bole', 'Salaga'],
      },
      {
        code: 'UE',
        name: 'Upper East',
        cities: ['Bolgatanga', 'Bawku', 'Navrongo'],
      },
      {
        code: 'UW',
        name: 'Upper West',
        cities: ['Wa', 'Lawra', 'Tumu'],
      },
      {
        code: 'TV',
        name: 'Volta',
        cities: ['Ho', 'Keta', 'Hohoe', 'Aflao'],
      },
      {
        code: 'WP',
        name: 'Western',
        cities: ['Takoradi', 'Sekondi', 'Tarkwa', 'Axim'],
      },
      {
        code: 'WN',
        name: 'Western North',
        cities: ['Sefwi Wiawso', 'Bibiani', 'Enchi'],
      },
    ],
  },

  // ── Benin ────────────────────────────────────────────
  {
    code: 'BJ',
    name: 'Benin',
    states: [
      {
        code: 'AL',
        name: 'Alibori',
        cities: ['Kandi', 'Banikoara', 'Malanville'],
      },
      {
        code: 'AK',
        name: 'Atacora',
        cities: ['Natitingou', 'Tanguiéta'],
      },
      {
        code: 'AQ',
        name: 'Atlantique',
        cities: ['Ouidah', 'Abomey-Calavi', 'Allada'],
      },
      {
        code: 'BO',
        name: 'Borgou',
        cities: ['Parakou', 'Nikki', 'Tchaourou'],
      },
      {
        code: 'CO',
        name: 'Collines',
        cities: ['Dassa-Zoumé', 'Savalou', 'Glazoué'],
      },
      {
        code: 'KO',
        name: 'Couffo',
        cities: ['Aplahoué', 'Dogbo'],
      },
      {
        code: 'DO',
        name: 'Donga',
        cities: ['Djougou', 'Bassila'],
      },
      {
        code: 'LI',
        name: 'Littoral',
        cities: ['Cotonou', 'Ganhi', 'Akpakpa'],
      },
      {
        code: 'MO',
        name: 'Mono',
        cities: ['Lokossa', 'Comé'],
      },
      {
        code: 'OU',
        name: 'Ouémé',
        cities: ['Porto-Novo', 'Pobé', 'Sakété'],
      },
      {
        code: 'PL',
        name: 'Plateau',
        cities: ['Sakété', 'Kétou', 'Pobè'],
      },
      {
        code: 'ZO',
        name: 'Zou',
        cities: ['Abomey', 'Bohicon', 'Covè'],
      },
    ],
  },

  // ── Cameroon ─────────────────────────────────────────
  {
    code: 'CM',
    name: 'Cameroon',
    states: [
      {
        code: 'AD',
        name: 'Adamawa',
        cities: ['Ngaoundéré', 'Meiganga', 'Banyo'],
      },
      {
        code: 'CE',
        name: 'Centre',
        cities: ['Yaoundé', 'Mbalmayo', 'Obala', 'Bafia'],
      },
      {
        code: 'ES',
        name: 'East',
        cities: ['Bertoua', 'Batouri', 'Abong-Mbang'],
      },
      {
        code: 'EN',
        name: 'Far North',
        cities: ['Maroua', 'Kousséri', 'Mokolo'],
      },
      {
        code: 'LT',
        name: 'Littoral',
        cities: ['Douala', 'Edéa', 'Nkongsamba', 'Limbé'],
      },
      {
        code: 'NO',
        name: 'North',
        cities: ['Garoua', 'Guider', 'Figuil'],
      },
      {
        code: 'NW',
        name: 'North-West',
        cities: ['Bamenda', 'Kumbo', 'Wum'],
      },
      {
        code: 'OU',
        name: 'West',
        cities: ['Bafoussam', 'Dschang', 'Mbouda', 'Bandjoun'],
      },
      {
        code: 'SU',
        name: 'South',
        cities: ['Ebolowa', 'Kribi', 'Sangmélima'],
      },
      {
        code: 'SW',
        name: 'South-West',
        cities: ['Buea', 'Limbe', 'Kumba', 'Tiko'],
      },
    ],
  },

  // ── Kenya ────────────────────────────────────────────
  {
    code: 'KE',
    name: 'Kenya',
    states: [
      {
        code: 'NAI',
        name: 'Nairobi',
        cities: [
          'Nairobi',
          'Westlands',
          'Karen',
          'Kilimani',
          'Eastleigh',
          'Kasarani',
          'Langata',
        ],
      },
      {
        code: 'MSA',
        name: 'Mombasa',
        cities: ['Mombasa', 'Nyali', 'Likoni', 'Changamwe'],
      },
      {
        code: 'KIA',
        name: 'Kiambu',
        cities: ['Kiambu', 'Thika', 'Ruiru', 'Kikuyu', 'Limuru'],
      },
      {
        code: 'NAK',
        name: 'Nakuru',
        cities: ['Nakuru', 'Naivasha', 'Gilgil'],
      },
      {
        code: 'KIS',
        name: 'Kisumu',
        cities: ['Kisumu', 'Muhoroni', 'Ahero'],
      },
      {
        code: 'UAS',
        name: 'Uasin Gishu',
        cities: ['Eldoret', 'Burnt Forest'],
      },
      {
        code: 'MAC',
        name: 'Machakos',
        cities: ['Machakos', 'Athi River', 'Mavoko'],
      },
      {
        code: 'KAJ',
        name: 'Kajiado',
        cities: ['Kajiado', 'Kitengela', 'Ngong', 'Ongata Rongai'],
      },
      {
        code: 'NYE',
        name: 'Nyeri',
        cities: ['Nyeri', 'Karatina', 'Othaya'],
      },
      {
        code: 'MER',
        name: 'Meru',
        cities: ['Meru', 'Maua', 'Nkubu'],
      },
      {
        code: 'KIL',
        name: 'Kilifi',
        cities: ['Kilifi', 'Malindi', 'Watamu'],
      },
      {
        code: 'KWA',
        name: 'Kwale',
        cities: ['Kwale', 'Ukunda', 'Diani'],
      },
      {
        code: 'GAR',
        name: 'Garissa',
        cities: ['Garissa'],
      },
      {
        code: 'KISII',
        name: 'Kisii',
        cities: ['Kisii', 'Ogembo'],
      },
      {
        code: 'BUN',
        name: 'Bungoma',
        cities: ['Bungoma', 'Webuye', 'Kimilili'],
      },
    ],
  },

  // ── South Africa ──────────────────────────────────────
  {
    code: 'ZA',
    name: 'South Africa',
    states: [
      {
        code: 'EC',
        name: 'Eastern Cape',
        cities: ['Gqeberha', 'East London', 'Mthatha', 'Makhanda'],
      },
      {
        code: 'FS',
        name: 'Free State',
        cities: ['Bloemfontein', 'Welkom', 'Sasolburg'],
      },
      {
        code: 'GP',
        name: 'Gauteng',
        cities: [
          'Johannesburg',
          'Pretoria',
          'Sandton',
          'Midrand',
          'Centurion',
          'Soweto',
          'Randburg',
          'Roodepoort',
        ],
      },
      {
        code: 'KZN',
        name: 'KwaZulu-Natal',
        cities: ['Durban', 'Pietermaritzburg', 'Richards Bay', 'Ballito'],
      },
      {
        code: 'LP',
        name: 'Limpopo',
        cities: ['Polokwane', 'Tzaneen', 'Thohoyandou'],
      },
      {
        code: 'MP',
        name: 'Mpumalanga',
        cities: ['Mbombela', 'Witbank', 'Secunda', 'Middelburg'],
      },
      {
        code: 'NC',
        name: 'Northern Cape',
        cities: ['Kimberley', 'Upington', 'Springbok'],
      },
      {
        code: 'NW',
        name: 'North West',
        cities: ['Mahikeng', 'Rustenburg', 'Potchefstroom', 'Klerksdorp'],
      },
      {
        code: 'WC',
        name: 'Western Cape',
        cities: [
          'Cape Town',
          'Stellenbosch',
          'Paarl',
          'George',
          'Somerset West',
          'Bellville',
        ],
      },
    ],
  },

  // ── Egypt ────────────────────────────────────────────
  {
    code: 'EG',
    name: 'Egypt',
    states: [
      {
        code: 'C',
        name: 'Cairo',
        cities: ['Cairo', 'Nasr City', 'Heliopolis', 'Maadi', 'Zamalek'],
      },
      {
        code: 'GZ',
        name: 'Giza',
        cities: ['Giza', '6th of October', 'Sheikh Zayed', 'Dokki'],
      },
      {
        code: 'ALX',
        name: 'Alexandria',
        cities: ['Alexandria', 'Borg El Arab'],
      },
      {
        code: 'DK',
        name: 'Dakahlia',
        cities: ['Mansoura', 'Mit Ghamr'],
      },
      {
        code: 'SH',
        name: 'Sharqia',
        cities: ['Zagazig', '10th of Ramadan'],
      },
      {
        code: 'GH',
        name: 'Gharbia',
        cities: ['Tanta', 'El Mahalla'],
      },
      {
        code: 'QN',
        name: 'Qalyubia',
        cities: ['Benha', 'Shubra El Kheima', 'Obour'],
      },
      {
        code: 'AS',
        name: 'Aswan',
        cities: ['Aswan'],
      },
      {
        code: 'LX',
        name: 'Luxor',
        cities: ['Luxor'],
      },
      {
        code: 'RS',
        name: 'Red Sea',
        cities: ['Hurghada', 'El Gouna', 'Safaga'],
      },
      {
        code: 'SIN',
        name: 'South Sinai',
        cities: ['Sharm El Sheikh', 'Dahab'],
      },
      {
        code: 'IS',
        name: 'Ismailia',
        cities: ['Ismailia'],
      },
      {
        code: 'SU',
        name: 'Suez',
        cities: ['Suez'],
      },
      {
        code: 'PT',
        name: 'Port Said',
        cities: ['Port Said'],
      },
    ],
  },

  // ── United States ────────────────────────────────────
  {
    code: 'US',
    name: 'United States',
    states: [
      { code: 'AL', name: 'Alabama', cities: ['Birmingham', 'Montgomery', 'Mobile', 'Huntsville'] },
      { code: 'AK', name: 'Alaska', cities: ['Anchorage', 'Fairbanks', 'Juneau'] },
      { code: 'AZ', name: 'Arizona', cities: ['Phoenix', 'Tucson', 'Mesa', 'Scottsdale'] },
      { code: 'AR', name: 'Arkansas', cities: ['Little Rock', 'Fayetteville', 'Fort Smith'] },
      {
        code: 'CA',
        name: 'California',
        cities: [
          'Los Angeles',
          'San Francisco',
          'San Diego',
          'San Jose',
          'Sacramento',
          'Oakland',
          'Fresno',
          'Long Beach',
          'Irvine',
        ],
      },
      { code: 'CO', name: 'Colorado', cities: ['Denver', 'Colorado Springs', 'Aurora', 'Boulder'] },
      { code: 'CT', name: 'Connecticut', cities: ['Hartford', 'New Haven', 'Stamford', 'Bridgeport'] },
      { code: 'DE', name: 'Delaware', cities: ['Wilmington', 'Dover', 'Newark'] },
      {
        code: 'FL',
        name: 'Florida',
        cities: [
          'Miami',
          'Orlando',
          'Tampa',
          'Jacksonville',
          'Fort Lauderdale',
          'Tallahassee',
          'St. Petersburg',
        ],
      },
      {
        code: 'GA',
        name: 'Georgia',
        cities: ['Atlanta', 'Savannah', 'Augusta', 'Columbus', 'Athens'],
      },
      { code: 'HI', name: 'Hawaii', cities: ['Honolulu', 'Hilo', 'Kailua'] },
      { code: 'ID', name: 'Idaho', cities: ['Boise', 'Meridian', 'Idaho Falls'] },
      {
        code: 'IL',
        name: 'Illinois',
        cities: ['Chicago', 'Aurora', 'Naperville', 'Springfield', 'Peoria'],
      },
      { code: 'IN', name: 'Indiana', cities: ['Indianapolis', 'Fort Wayne', 'Evansville', 'South Bend'] },
      { code: 'IA', name: 'Iowa', cities: ['Des Moines', 'Cedar Rapids', 'Davenport'] },
      { code: 'KS', name: 'Kansas', cities: ['Wichita', 'Kansas City', 'Topeka', 'Overland Park'] },
      { code: 'KY', name: 'Kentucky', cities: ['Louisville', 'Lexington', 'Bowling Green'] },
      {
        code: 'LA',
        name: 'Louisiana',
        cities: ['New Orleans', 'Baton Rouge', 'Shreveport', 'Lafayette'],
      },
      { code: 'ME', name: 'Maine', cities: ['Portland', 'Augusta', 'Bangor'] },
      {
        code: 'MD',
        name: 'Maryland',
        cities: ['Baltimore', 'Annapolis', 'Rockville', 'Silver Spring'],
      },
      {
        code: 'MA',
        name: 'Massachusetts',
        cities: ['Boston', 'Cambridge', 'Worcester', 'Springfield'],
      },
      {
        code: 'MI',
        name: 'Michigan',
        cities: ['Detroit', 'Grand Rapids', 'Ann Arbor', 'Lansing'],
      },
      {
        code: 'MN',
        name: 'Minnesota',
        cities: ['Minneapolis', 'Saint Paul', 'Rochester', 'Duluth'],
      },
      { code: 'MS', name: 'Mississippi', cities: ['Jackson', 'Gulfport', 'Biloxi'] },
      {
        code: 'MO',
        name: 'Missouri',
        cities: ['Kansas City', 'St. Louis', 'Springfield', 'Columbia'],
      },
      { code: 'MT', name: 'Montana', cities: ['Billings', 'Missoula', 'Great Falls', 'Bozeman'] },
      { code: 'NE', name: 'Nebraska', cities: ['Omaha', 'Lincoln', 'Bellevue'] },
      {
        code: 'NV',
        name: 'Nevada',
        cities: ['Las Vegas', 'Henderson', 'Reno', 'Carson City'],
      },
      { code: 'NH', name: 'New Hampshire', cities: ['Manchester', 'Nashua', 'Concord'] },
      {
        code: 'NJ',
        name: 'New Jersey',
        cities: ['Newark', 'Jersey City', 'Paterson', 'Trenton', 'Princeton'],
      },
      { code: 'NM', name: 'New Mexico', cities: ['Albuquerque', 'Santa Fe', 'Las Cruces'] },
      {
        code: 'NY',
        name: 'New York',
        cities: [
          'New York City',
          'Brooklyn',
          'Manhattan',
          'Queens',
          'Buffalo',
          'Rochester',
          'Albany',
          'Syracuse',
        ],
      },
      {
        code: 'NC',
        name: 'North Carolina',
        cities: ['Charlotte', 'Raleigh', 'Durham', 'Greensboro', 'Asheville'],
      },
      { code: 'ND', name: 'North Dakota', cities: ['Fargo', 'Bismarck', 'Grand Forks'] },
      {
        code: 'OH',
        name: 'Ohio',
        cities: ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron'],
      },
      {
        code: 'OK',
        name: 'Oklahoma',
        cities: ['Oklahoma City', 'Tulsa', 'Norman'],
      },
      {
        code: 'OR',
        name: 'Oregon',
        cities: ['Portland', 'Salem', 'Eugene', 'Bend'],
      },
      {
        code: 'PA',
        name: 'Pennsylvania',
        cities: ['Philadelphia', 'Pittsburgh', 'Allentown', 'Harrisburg'],
      },
      { code: 'RI', name: 'Rhode Island', cities: ['Providence', 'Warwick', 'Newport'] },
      {
        code: 'SC',
        name: 'South Carolina',
        cities: ['Charleston', 'Columbia', 'Greenville', 'Myrtle Beach'],
      },
      { code: 'SD', name: 'South Dakota', cities: ['Sioux Falls', 'Rapid City', 'Aberdeen'] },
      {
        code: 'TN',
        name: 'Tennessee',
        cities: ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga'],
      },
      {
        code: 'TX',
        name: 'Texas',
        cities: [
          'Houston',
          'Dallas',
          'Austin',
          'San Antonio',
          'Fort Worth',
          'El Paso',
          'Plano',
          'Arlington',
        ],
      },
      {
        code: 'UT',
        name: 'Utah',
        cities: ['Salt Lake City', 'Provo', 'Ogden', 'Park City'],
      },
      { code: 'VT', name: 'Vermont', cities: ['Burlington', 'Montpelier', 'Rutland'] },
      {
        code: 'VA',
        name: 'Virginia',
        cities: ['Virginia Beach', 'Richmond', 'Norfolk', 'Arlington', 'Alexandria'],
      },
      {
        code: 'WA',
        name: 'Washington',
        cities: ['Seattle', 'Spokane', 'Tacoma', 'Bellevue', 'Olympia'],
      },
      {
        code: 'WV',
        name: 'West Virginia',
        cities: ['Charleston', 'Huntington', 'Morgantown'],
      },
      {
        code: 'WI',
        name: 'Wisconsin',
        cities: ['Milwaukee', 'Madison', 'Green Bay', 'Kenosha'],
      },
      { code: 'WY', name: 'Wyoming', cities: ['Cheyenne', 'Casper', 'Jackson'] },
      {
        code: 'DC',
        name: 'District of Columbia',
        cities: ['Washington'],
      },
    ],
  },

  // ── Canada ───────────────────────────────────────────
  {
    code: 'CA',
    name: 'Canada',
    states: [
      {
        code: 'AB',
        name: 'Alberta',
        cities: ['Calgary', 'Edmonton', 'Red Deer', 'Lethbridge'],
      },
      {
        code: 'BC',
        name: 'British Columbia',
        cities: ['Vancouver', 'Victoria', 'Burnaby', 'Surrey', 'Kelowna', 'Richmond'],
      },
      {
        code: 'MB',
        name: 'Manitoba',
        cities: ['Winnipeg', 'Brandon'],
      },
      {
        code: 'NB',
        name: 'New Brunswick',
        cities: ['Moncton', 'Saint John', 'Fredericton'],
      },
      {
        code: 'NL',
        name: 'Newfoundland and Labrador',
        cities: ['St. John’s', 'Mount Pearl', 'Corner Brook'],
      },
      {
        code: 'NS',
        name: 'Nova Scotia',
        cities: ['Halifax', 'Dartmouth', 'Sydney'],
      },
      {
        code: 'ON',
        name: 'Ontario',
        cities: [
          'Toronto',
          'Ottawa',
          'Mississauga',
          'Brampton',
          'Hamilton',
          'London',
          'Markham',
          'Vaughan',
          'Kitchener',
          'Windsor',
        ],
      },
      {
        code: 'PE',
        name: 'Prince Edward Island',
        cities: ['Charlottetown', 'Summerside'],
      },
      {
        code: 'QC',
        name: 'Quebec',
        cities: ['Montreal', 'Quebec City', 'Laval', 'Gatineau', 'Longueuil'],
      },
      {
        code: 'SK',
        name: 'Saskatchewan',
        cities: ['Saskatoon', 'Regina', 'Prince Albert'],
      },
      {
        code: 'NT',
        name: 'Northwest Territories',
        cities: ['Yellowknife'],
      },
      {
        code: 'NU',
        name: 'Nunavut',
        cities: ['Iqaluit'],
      },
      {
        code: 'YT',
        name: 'Yukon',
        cities: ['Whitehorse'],
      },
    ],
  },

  // ── United Kingdom ───────────────────────────────────
  {
    code: 'GB',
    name: 'United Kingdom',
    states: [
      {
        code: 'ENG',
        name: 'England',
        cities: [
          'London',
          'Manchester',
          'Birmingham',
          'Leeds',
          'Bristol',
          'Liverpool',
          'Sheffield',
          'Newcastle',
          'Nottingham',
          'Leicester',
          'Southampton',
          'Brighton',
          'Oxford',
          'Cambridge',
          'Reading',
          'Coventry',
        ],
      },
      {
        code: 'SCT',
        name: 'Scotland',
        cities: ['Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee', 'Inverness', 'Stirling'],
      },
      {
        code: 'WLS',
        name: 'Wales',
        cities: ['Cardiff', 'Swansea', 'Newport', 'Wrexham', 'Bangor'],
      },
      {
        code: 'NIR',
        name: 'Northern Ireland',
        cities: ['Belfast', 'Derry', 'Lisburn', 'Newry'],
      },
    ],
  },

  // ── Germany ──────────────────────────────────────────
  {
    code: 'DE',
    name: 'Germany',
    states: [
      {
        code: 'BW',
        name: 'Baden-Württemberg',
        cities: ['Stuttgart', 'Mannheim', 'Karlsruhe', 'Freiburg', 'Heidelberg'],
      },
      {
        code: 'BY',
        name: 'Bavaria',
        cities: ['Munich', 'Nuremberg', 'Augsburg', 'Regensburg', 'Würzburg'],
      },
      {
        code: 'BE',
        name: 'Berlin',
        cities: ['Berlin'],
      },
      {
        code: 'BB',
        name: 'Brandenburg',
        cities: ['Potsdam', 'Cottbus', 'Brandenburg an der Havel'],
      },
      {
        code: 'HB',
        name: 'Bremen',
        cities: ['Bremen', 'Bremerhaven'],
      },
      {
        code: 'HH',
        name: 'Hamburg',
        cities: ['Hamburg'],
      },
      {
        code: 'HE',
        name: 'Hesse',
        cities: ['Frankfurt', 'Wiesbaden', 'Kassel', 'Darmstadt'],
      },
      {
        code: 'MV',
        name: 'Mecklenburg-Vorpommern',
        cities: ['Rostock', 'Schwerin', 'Neubrandenburg'],
      },
      {
        code: 'NI',
        name: 'Lower Saxony',
        cities: ['Hanover', 'Braunschweig', 'Oldenburg', 'Osnabrück'],
      },
      {
        code: 'NW',
        name: 'North Rhine-Westphalia',
        cities: [
          'Cologne',
          'Düsseldorf',
          'Dortmund',
          'Essen',
          'Bonn',
          'Münster',
          'Bielefeld',
        ],
      },
      {
        code: 'RP',
        name: 'Rhineland-Palatinate',
        cities: ['Mainz', 'Ludwigshafen', 'Koblenz', 'Trier'],
      },
      {
        code: 'SL',
        name: 'Saarland',
        cities: ['Saarbrücken', 'Neunkirchen'],
      },
      {
        code: 'SN',
        name: 'Saxony',
        cities: ['Dresden', 'Leipzig', 'Chemnitz'],
      },
      {
        code: 'ST',
        name: 'Saxony-Anhalt',
        cities: ['Magdeburg', 'Halle'],
      },
      {
        code: 'SH',
        name: 'Schleswig-Holstein',
        cities: ['Kiel', 'Lübeck', 'Flensburg'],
      },
      {
        code: 'TH',
        name: 'Thuringia',
        cities: ['Erfurt', 'Jena', 'Gera', 'Weimar'],
      },
    ],
  },

  // ── France ───────────────────────────────────────────
  {
    code: 'FR',
    name: 'France',
    states: [
      {
        code: 'IDF',
        name: 'Île-de-France',
        cities: [
          'Paris',
          'Boulogne-Billancourt',
          'Saint-Denis',
          'Versailles',
          'Créteil',
          'Nanterre',
        ],
      },
      {
        code: 'ARA',
        name: 'Auvergne-Rhône-Alpes',
        cities: ['Lyon', 'Grenoble', 'Saint-Étienne', 'Clermont-Ferrand', 'Annecy'],
      },
      {
        code: 'BFC',
        name: 'Bourgogne-Franche-Comté',
        cities: ['Dijon', 'Besançon', 'Chalon-sur-Saône'],
      },
      {
        code: 'BRE',
        name: 'Brittany',
        cities: ['Rennes', 'Brest', 'Quimper', 'Vannes'],
      },
      {
        code: 'CVL',
        name: 'Centre-Val de Loire',
        cities: ['Orléans', 'Tours', 'Blois'],
      },
      {
        code: 'COR',
        name: 'Corsica',
        cities: ['Ajaccio', 'Bastia'],
      },
      {
        code: 'GES',
        name: 'Grand Est',
        cities: ['Strasbourg', 'Reims', 'Metz', 'Mulhouse', 'Nancy'],
      },
      {
        code: 'HDF',
        name: 'Hauts-de-France',
        cities: ['Lille', 'Amiens', 'Roubaix', 'Tourcoing'],
      },
      {
        code: 'NOR',
        name: 'Normandy',
        cities: ['Rouen', 'Caen', 'Le Havre'],
      },
      {
        code: 'NAQ',
        name: 'Nouvelle-Aquitaine',
        cities: ['Bordeaux', 'Limoges', 'Poitiers', 'La Rochelle'],
      },
      {
        code: 'OCC',
        name: 'Occitanie',
        cities: ['Toulouse', 'Montpellier', 'Nîmes', 'Perpignan'],
      },
      {
        code: 'PDL',
        name: 'Pays de la Loire',
        cities: ['Nantes', 'Angers', 'Le Mans', 'Saint-Nazaire'],
      },
      {
        code: 'PAC',
        name: "Provence-Alpes-Côte d'Azur",
        cities: ['Marseille', 'Nice', 'Toulon', 'Aix-en-Provence', 'Cannes', 'Avignon'],
      },
    ],
  },

  // ── Australia ────────────────────────────────────────
  {
    code: 'AU',
    name: 'Australia',
    states: [
      {
        code: 'NSW',
        name: 'New South Wales',
        cities: [
          'Sydney',
          'Newcastle',
          'Wollongong',
          'Parramatta',
          'Central Coast',
          'Wagga Wagga',
        ],
      },
      {
        code: 'VIC',
        name: 'Victoria',
        cities: ['Melbourne', 'Geelong', 'Ballarat', 'Bendigo', 'Mornington'],
      },
      {
        code: 'QLD',
        name: 'Queensland',
        cities: [
          'Brisbane',
          'Gold Coast',
          'Sunshine Coast',
          'Townsville',
          'Cairns',
          'Toowoomba',
        ],
      },
      {
        code: 'WA',
        name: 'Western Australia',
        cities: ['Perth', 'Fremantle', 'Bunbury', 'Geraldton'],
      },
      {
        code: 'SA',
        name: 'South Australia',
        cities: ['Adelaide', 'Mount Gambier', 'Whyalla'],
      },
      {
        code: 'TAS',
        name: 'Tasmania',
        cities: ['Hobart', 'Launceston', 'Devonport'],
      },
      {
        code: 'ACT',
        name: 'Australian Capital Territory',
        cities: ['Canberra'],
      },
      {
        code: 'NT',
        name: 'Northern Territory',
        cities: ['Darwin', 'Alice Springs', 'Palmerston'],
      },
    ],
  },
]

export type FulfillmentLocationInput = {
  countryCode: string
  country: string
  stateCode?: string
  state?: string
  city: string
}

/** Public label: city + country only */
export function buildFulfillmentDisplayLabel(
  city: string,
  country: string,
): string {
  const c = (city || '').trim()
  const co = (country || '').trim()
  if (c && co) return `${c}, ${co}`
  return c || co || ''
}

export function buildFulfillmentLocation(
  input: FulfillmentLocationInput,
): FulfillmentLocationInput & { displayLabel: string } {
  return {
    countryCode: input.countryCode,
    country: input.country,
    stateCode: input.stateCode || '',
    state: input.state || '',
    city: input.city,
    displayLabel: buildFulfillmentDisplayLabel(input.city, input.country),
  }
}

export function getCountryByCode(code: string) {
  return FULFILLMENT_COUNTRIES.find((c) => c.code === code)
}

export function getStatesForCountry(countryCode: string) {
  return getCountryByCode(countryCode)?.states || []
}

export function getCitiesForState(countryCode: string, stateCode: string) {
  const state = getStatesForCountry(countryCode).find(
    (s) => s.code === stateCode,
  )
  return state?.cities || []
}
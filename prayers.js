// Prayer corpus for Stand — English and Spanish.
//
// Imported from the REMAM corpus (dougdevitre/remam,
// packages/data/content/prayers.json), which states that every composed line
// is an original composition or a universal public-domain prayer, with no
// copyrighted Bible translation quoted. The ecological "Laudato Si'" slot and
// the creation/defenders intentions are REMAM-specific and were not carried
// over; the "fear" and "courage" bodies are Stand's own, written in the same
// register in both languages.
//
// Every block carries both languages ({ en, es }); compose.js picks one by the
// reader's chosen language. `tradition` marks what is specifically Roman
// Catholic devotion — six of the traditional prayers, and the Marian and
// Franciscan closings — as against prayers shared across the wider Christian
// tradition. The app groups and labels the two rather than blurring them, and
// meta.defaultClosingTraditions decides which closings "As composed" draws on.
//
// Shape, per REMAM: every block is a complete sentence or two, so any one block
// per slot reads as a whole prayer. Composition is deterministic and offline
// (see compose.js) — every line a reader can see is reviewable here.
// Traditional items carry `audio` pacing metadata: each `breaks[lang][].after`
// must be an exact, unique substring of that language's text;
// `scripts/validate-prayers.js` enforces that and REMAM's generator limits.
const prayerCorpus = {
  "meta": {
    "languages": [
      {
        "id": "en",
        "label": "English"
      },
      {
        "id": "es",
        "label": "Español"
      }
    ],
    "petitionTemplate": {
      "en": "We entrust to You especially this intention: {petition}.",
      "es": "Te encomendamos especialmente esta intención: {petition}."
    },
    "reviewNote": {
      "en": "Draft devotional content, pending review by a pastoral advisor. Composed only from this reviewable corpus — no AI at the moment of use.",
      "es": "Contenido devocional en borrador, pendiente de revisión por un asesor pastoral. Compuesto únicamente a partir de este corpus revisable — sin inteligencia artificial en el momento de uso."
    },
    "review": "imported-pending-review",
    "source": "dougdevitre/remam — packages/data/content/prayers.json",
    "traditionNotes": {
      "universal": {
        "en": "Shared across the wider Christian tradition.",
        "es": "Compartidas por la tradici\u00f3n cristiana en general."
      },
      "roman-catholic": {
        "en": "Specifically Roman Catholic devotions.",
        "es": "Devociones propiamente cat\u00f3licas romanas."
      }
    },
    "traditionLabels": {
      "universal": {
        "en": "Traditional prayers",
        "es": "Oraciones tradicionales"
      },
      "roman-catholic": {
        "en": "Roman Catholic prayers",
        "es": "Oraciones católicas romanas"
      }
    },
    "defaultClosingTraditions": [
      "universal"
    ]
  },
  "modes": {
    "prayer": {
      "name": {
        "en": "Prayer",
        "es": "Oración"
      },
      "intentions": [
        {
          "id": "fear",
          "label": {
            "en": "In fear",
            "es": "En el miedo"
          }
        },
        {
          "id": "courage",
          "label": {
            "en": "For courage",
            "es": "Por el valor"
          }
        },
        {
          "id": "family",
          "label": {
            "en": "For the family",
            "es": "Por la familia"
          }
        },
        {
          "id": "community",
          "label": {
            "en": "For the community",
            "es": "Por la comunidad"
          }
        },
        {
          "id": "gratitude",
          "label": {
            "en": "Of gratitude",
            "es": "De gratitud"
          }
        },
        {
          "id": "guidance",
          "label": {
            "en": "For guidance",
            "es": "Pidiendo guía"
          }
        },
        {
          "id": "sick",
          "label": {
            "en": "For the sick",
            "es": "Por los enfermos"
          }
        }
      ],
      "slots": {
        "invocation": [
          {
            "en": "In the name of the Father, and of the Son, and of the Holy Spirit.",
            "es": "En el nombre del Padre, y del Hijo, y del Espíritu Santo."
          },
          {
            "en": "God of life, Creator of heaven and earth, we come before You with open hearts.",
            "es": "Dios de la vida, Creador del cielo y de la tierra, venimos ante Ti con el corazón abierto."
          },
          {
            "en": "Lord Jesus, Word through whom all things were made, hear our prayer.",
            "es": "Señor Jesús, Palabra por quien todo fue hecho, escucha nuestra oración."
          },
          {
            "en": "Holy Spirit, breath of life who renews the face of the earth, come to meet us.",
            "es": "Espíritu Santo, soplo de vida que renueva la faz de la tierra, ven a nuestro encuentro."
          },
          {
            "en": "Good Father, who look with tenderness on all You have created, look also upon us.",
            "es": "Padre bueno, que miras con ternura todo lo que has creado, míranos también a nosotros."
          },
          {
            "en": "Triune God, communion of love, gather us into Your presence.",
            "es": "Dios Trino, comunión de amor, reúnenos en tu presencia."
          }
        ],
        "body": {
          "fear": [
            {
              "en": "We bring You the fear we are carrying: the thoughts that will not quiet, the outcomes we cannot hold. Steady what is shaking in us, and give us peace enough for today.",
              "es": "Te traemos el miedo que llevamos: los pensamientos que no callan, los desenlaces que no podemos sostener. Afirma lo que tiembla en nosotros y danos la paz que basta para hoy."
            },
            {
              "en": "Lord, our fear runs ahead of us into days that have not arrived. Call us back to this hour, and give us what this hour actually asks of us.",
              "es": "Señor, nuestro miedo se adelanta a días que todavía no llegan. Llámanos de vuelta a esta hora y danos lo que esta hora realmente nos pide."
            },
            {
              "en": "When dread wakes us and will not let us rest, remind us that You are awake, that You are not anxious, and that we are held.",
              "es": "Cuando la angustia nos despierta y no nos deja descansar, recuérdanos que Tú estás despierto, que Tú no te angustias y que estamos en tus manos."
            }
          ],
          "courage": [
            {
              "en": "Give us courage that does not wait for the fear to pass: enough to take the next right step while we are still afraid.",
              "es": "Danos un valor que no espere a que pase el miedo: el suficiente para dar el siguiente paso correcto aun mientras tememos."
            },
            {
              "en": "Make us brave in ordinary ways, Lord — the honest word, the hard call, the thing we have avoided — and let our courage serve someone besides ourselves.",
              "es": "Haznos valientes en lo ordinario, Señor: la palabra honesta, la llamada difícil, aquello que hemos evitado; y que nuestro valor sirva a alguien más que a nosotros mismos."
            },
            {
              "en": "Strengthen all who must do something difficult today. Let them find that they are able, and let them not have to do it alone.",
              "es": "Fortalece a todos los que hoy deben hacer algo difícil. Que descubran que son capaces y que no tengan que hacerlo solos."
            }
          ],
          "guidance": [
            {
              "en": "Enlighten our decisions, Lord: show us the right path and give us the humility to follow it even when it costs.",
              "es": "Ilumina, Señor, nuestras decisiones: muéstranos el camino recto y danos la humildad de seguirlo aunque cueste."
            },
            {
              "en": "When doubt holds us back, remind us that You walk with us; when weariness overcomes us, renew our strength.",
              "es": "Cuando la duda nos detenga, recuérdanos que Tú caminas con nosotros; cuando el cansancio nos venza, renueva nuestras fuerzas."
            },
            {
              "en": "Give us a listening heart, to discern Your will and to serve You in our brothers and sisters.",
              "es": "Danos un corazón que escuche, para discernir tu voluntad y servirte en los hermanos."
            }
          ],
          "sick": [
            {
              "en": "We bring our sick before You: lay Your hand upon them, ease their pain, sustain those who care for them, and grant them Your peace.",
              "es": "Te presentamos a nuestros enfermos: pon tu mano sobre ellos, alivia su dolor, sostén a quienes los cuidan y concédeles tu paz."
            },
            {
              "en": "Lord, who visited and healed the sick, accompany those who suffer in body or soul, and do not let them lose hope.",
              "es": "Señor, que visitaste y sanaste a los enfermos, acompaña a los que sufren en cuerpo o en alma, y no permitas que pierdan la esperanza."
            },
            {
              "en": "Bless the hands of doctors, nurses, and caregivers, and make our community a place of comfort for those who suffer.",
              "es": "Bendice las manos de médicos, enfermeras y cuidadores, y haz de nuestra comunidad un lugar de consuelo para los que sufren."
            }
          ],
          "family": [
            {
              "en": "Bless our families: sustain fathers and mothers in their work, protect the children, accompany the grandparents, and make of every home a little church.",
              "es": "Bendice a nuestras familias: sostén a los padres y madres en su trabajo, protege a los niños, acompaña a los abuelos, y haz de cada hogar una pequeña iglesia."
            },
            {
              "en": "Where there are wounds in our family, sow Your peace; where there is distance, open paths of encounter; where there is need, provide from Your abundance.",
              "es": "Donde haya heridas en nuestra familia, siembra tu paz; donde haya distancia, abre caminos de encuentro; donde haya necesidad, provee con tu abundancia."
            },
            {
              "en": "May bread never be lacking at our table, and may the gratitude of sharing it never be lacking either.",
              "es": "Que en nuestra mesa nunca falte el pan, y que nunca falte tampoco la gratitud de compartirlo."
            }
          ],
          "community": [
            {
              "en": "We pray for our community: that we may listen to one another, work together, and bear one another's burdens.",
              "es": "Te pedimos por nuestra comunidad: que sepamos escucharnos, trabajar juntos y cargar los unos las cargas de los otros."
            },
            {
              "en": "Make our parish a house with open doors, where the poor find bread, the afflicted find comfort, and the stranger finds a brother.",
              "es": "Haz de nuestra parroquia una casa de puertas abiertas, donde el pobre encuentre pan, el afligido consuelo y el extraño un hermano."
            },
            {
              "en": "Unite what is divided among us, and may our communion bear witness to Your Kingdom.",
              "es": "Une lo que está dividido entre nosotros, y que nuestra comunión sea testimonio de tu Reino."
            }
          ],
          "gratitude": [
            {
              "en": "Thank You, Lord, for the gift of this day: for the light, for our work, for our food, and for the people You placed on our path.",
              "es": "Gracias, Señor, por el don de este día: por la luz, por el trabajo, por el alimento y por las personas que pusiste en nuestro camino."
            },
            {
              "en": "All that we have we have received from Your hand; may our gratitude become generosity toward others.",
              "es": "Todo lo que tenemos lo hemos recibido de tu mano; que nuestra gratitud se vuelva generosidad con los demás."
            },
            {
              "en": "We praise You for the wonders of creation that surround us, and for the faith that sustains us on difficult days.",
              "es": "Te alabamos por las maravillas de la creación que nos rodean, y por la fe que nos sostiene en los días difíciles."
            }
          ]
        },
        "closing": [
          {
            "style": "simple",
            "tradition": "universal",
            "en": "We ask this through Jesus Christ, our Lord. Amen.",
            "es": "Te lo pedimos por Jesucristo, nuestro Señor. Amén."
          },
          {
            "style": "marian",
            "tradition": "roman-catholic",
            "en": "Mary, Mother of God and our Mother, pray for us. Amen.",
            "es": "María, Madre de Dios y Madre nuestra, ruega por nosotros. Amén."
          },
          {
            "style": "trinitarian",
            "tradition": "universal",
            "en": "Glory be to the Father, and to the Son, and to the Holy Spirit, as it was in the beginning, is now, and ever shall be, world without end. Amen.",
            "es": "Gloria al Padre, y al Hijo, y al Espíritu Santo, como era en el principio, ahora y siempre, por los siglos de los siglos. Amén."
          },
          {
            "style": "simple",
            "tradition": "universal",
            "en": "May the Lord bless us, keep us from all evil, and bring us to everlasting life. Amen.",
            "es": "Que el Señor nos bendiga, nos guarde de todo mal y nos lleve a la vida eterna. Amén."
          },
          {
            "style": "franciscan",
            "tradition": "roman-catholic",
            "en": "Saint Francis of Assisi, guardian of creation, intercede for us. Amen.",
            "es": "San Francisco de Asís, custodio de la creación, intercede por nosotros. Amén."
          },
          {
            "style": "marian",
            "tradition": "roman-catholic",
            "en": "Virgin of Guadalupe, patroness of our America, cover us with your mantle. Amen.",
            "es": "Virgen de Guadalupe, patrona de nuestra América, cúbrenos con tu manto. Amén."
          }
        ]
      }
    },
    "forgiveness": {
      "name": {
        "en": "Forgiveness",
        "es": "Perdón"
      },
      "intentions": [
        {
          "id": "family",
          "label": {
            "en": "A wound in the family",
            "es": "Una herida en la familia"
          }
        },
        {
          "id": "community",
          "label": {
            "en": "A conflict in the community",
            "es": "Un conflicto en la comunidad"
          }
        },
        {
          "id": "receiving",
          "label": {
            "en": "I need to be forgiven",
            "es": "Necesito ser perdonado"
          }
        },
        {
          "id": "self",
          "label": {
            "en": "Forgiving myself",
            "es": "Perdonarme a mí mismo"
          }
        }
      ],
      "slots": {
        "invocation": [
          {
            "en": "God of mercy, who never tire of forgiving, I come before You just as I am.",
            "es": "Dios de misericordia, que no te cansas de perdonar, me presento ante Ti tal como soy."
          },
          {
            "en": "Good Father, who run to meet the returning child, receive me into Your arms.",
            "es": "Padre bueno, que corres al encuentro del hijo que vuelve, recíbeme en tus brazos."
          },
          {
            "en": "Lord Jesus, who forgave from the cross, teach me the way of forgiveness.",
            "es": "Señor Jesús, que desde la cruz perdonaste, enséñame el camino del perdón."
          },
          {
            "en": "Holy Spirit, Consoler, soften what has hardened within me.",
            "es": "Espíritu Santo, consolador, ablanda lo que en mí se ha endurecido."
          },
          {
            "en": "In the name of the Father, and of the Son, and of the Holy Spirit: I come seeking the peace that only You can give.",
            "es": "En el nombre del Padre, y del Hijo, y del Espíritu Santo: vengo a buscar la paz que solo Tú puedes dar."
          }
        ],
        "examen": [
          {
            "en": "In silence, before You, I acknowledge what has happened and what has hurt.",
            "es": "En silencio, delante de Ti, reconozco lo que ha pasado y lo que ha dolido."
          },
          {
            "en": "I look at my heart truthfully: I see the wound, I see my own part in it, and I do not want to carry this alone.",
            "es": "Miro mi corazón con verdad: veo la herida, veo también mi parte, y no quiero cargar esto solo."
          },
          {
            "en": "You know what I myself cannot even name; bring it into Your light.",
            "es": "Tú conoces lo que ni yo mismo sé nombrar; ponlo Tú en tu luz."
          },
          {
            "en": "Give me the honesty not to excuse myself and the meekness not to condemn.",
            "es": "Dame la honestidad de no excusarme y la mansedumbre de no condenar."
          },
          {
            "en": "Remind me how often I have been forgiven, so that I too may know how to forgive.",
            "es": "Recuérdame cuántas veces he sido perdonado, para que yo también sepa perdonar."
          }
        ],
        "body": {
          "self": [
            {
              "en": "It is hard for me to forgive myself, Lord; I carry with me what I did and what I failed to do.",
              "es": "Me cuesta perdonarme, Señor; cargo conmigo lo que hice y lo que dejé de hacer."
            },
            {
              "en": "If You, who see everything, forgive me — who am I to condemn myself without end?",
              "es": "Si Tú, que todo lo ves, me perdonas, ¿quién soy yo para condenarme sin fin?"
            },
            {
              "en": "Teach me to see myself with Your eyes: truthfully, but also with the tenderness with which You look at me.",
              "es": "Enséñame a mirarme con tus ojos: con verdad, pero también con la ternura con que Tú me miras."
            }
          ],
          "receiving": [
            {
              "en": "Lord, I have failed, and I do not want to hide it from You: I ask Your forgiveness with a sincere heart.",
              "es": "Señor, he fallado, y no quiero esconderlo de Ti: te pido perdón con corazón sincero."
            },
            {
              "en": "Do not let shame drive me away from You; Your mercy is greater than my guilt.",
              "es": "No permitas que la vergüenza me aleje de Ti; tu misericordia es más grande que mi culpa."
            },
            {
              "en": "Give me the courage to ask forgiveness also of the one I offended, and to repair the harm where possible.",
              "es": "Dame la valentía de pedir perdón también a quien ofendí, y de reparar el daño en lo posible."
            }
          ],
          "family": [
            {
              "en": "I hand over to You this wound in my family: the long silences, the words that wounded, the distance that has grown between us.",
              "es": "Te entrego esta herida en mi familia: los silencios largos, las palabras que hirieron, la distancia que ha crecido entre nosotros."
            },
            {
              "en": "Give me the grace to take the first step, though it costs me, and to speak with truth and tenderness at once.",
              "es": "Dame la gracia de dar el primer paso, aunque me cueste, y de hablar con verdad y con ternura a la vez."
            },
            {
              "en": "Heal what is broken in our home, and give us back the joy of sitting together at the table.",
              "es": "Sana lo que en nuestra casa está roto, y devuélvenos la alegría de sentarnos juntos a la mesa."
            }
          ],
          "community": [
            {
              "en": "I hand over to You this conflict in our community: place Your peace where there is division, and Your truth where there is misunderstanding.",
              "es": "Te entrego este conflicto en nuestra comunidad: pon tu paz donde hay división, y tu verdad donde hay malentendidos."
            },
            {
              "en": "Keep me from feeding resentment with my words, and make me a builder of bridges where others raise walls.",
              "es": "Líbrame de alimentar el rencor con mis palabras, y hazme constructor de puentes donde otros levantan muros."
            },
            {
              "en": "May those of us who have been hurt not answer with the same harm, but with the serene firmness of the children of God.",
              "es": "Que quienes hemos sido lastimados no respondamos con el mismo daño, sino con la firmeza serena de los hijos de Dios."
            }
          ]
        },
        "contrition": [
          {
            "en": "My God, I repent with all my heart of my failings, for in sinning I have offended You, who are the supreme good.",
            "es": "Dios mío, me arrepiento de todo corazón de mis faltas, porque pecando te he ofendido a Ti, que eres el sumo bien."
          },
          {
            "en": "I firmly resolve, with the help of Your grace, to amend my ways and to turn away from the occasions of doing harm.",
            "es": "Propongo firmemente, con tu gracia, enmendarme y apartarme de las ocasiones de hacer daño."
          },
          {
            "en": "Wash me, Lord, and I shall be whiter than snow; create in me a pure heart.",
            "es": "Lávame, Señor, y quedaré más blanco que la nieve; crea en mí un corazón puro."
          },
          {
            "en": "Like the tax collector, I dare not raise my eyes, and I only say: have mercy on me, a sinner.",
            "es": "Como el publicano, no me atrevo a levantar los ojos, y solo digo: ten compasión de mí, que soy pecador."
          },
          {
            "en": "Grant me the grace to forgive as I wish to be forgiven — seventy times seven.",
            "es": "Concédeme la gracia de perdonar como quiero ser perdonado, setenta veces siete."
          }
        ],
        "closing": [
          {
            "style": "simple",
            "tradition": "universal",
            "en": "I ask this through Jesus Christ, our Lord. Amen.",
            "es": "Te lo pido por Jesucristo, nuestro Señor. Amén."
          },
          {
            "style": "marian",
            "tradition": "roman-catholic",
            "en": "Mary, Mother of mercy, accompany me on this path. Amen.",
            "es": "María, Madre de misericordia, acompáñame en este camino. Amén."
          },
          {
            "style": "simple",
            "tradition": "universal",
            "en": "May the peace of Christ, which surpasses all understanding, guard my heart. Amen.",
            "es": "Que la paz de Cristo, que sobrepasa todo entendimiento, guarde mi corazón. Amén."
          },
          {
            "style": "franciscan",
            "tradition": "roman-catholic",
            "en": "Lord, make me an instrument of Your peace: where there is offense, let me bring pardon. Amen.",
            "es": "Señor, haz de mí un instrumento de tu paz: que donde haya ofensa, ponga yo perdón. Amén."
          },
          {
            "style": "trinitarian",
            "tradition": "universal",
            "en": "Glory be to the Father, and to the Son, and to the Holy Spirit. Amen.",
            "es": "Gloria al Padre, y al Hijo, y al Espíritu Santo. Amén."
          }
        ]
      },
      "note": {
        "en": "This personal prayer does not replace the sacrament of Reconciliation. If something weighs on your conscience, go to a priest: in confession the Father's embrace awaits you.",
        "es": "Esta oración personal no sustituye el sacramento de la Reconciliación. Si algo pesa en tu conciencia, acércate a un sacerdote: en la confesión te espera el abrazo del Padre."
      }
    },
    "grace": {
      "name": {
        "en": "Grace",
        "es": "Bendición de la mesa"
      },
      "intentions": [
        {
          "id": "daily",
          "label": {
            "en": "Daily meal",
            "es": "Comida de cada día"
          }
        },
        {
          "id": "feast",
          "label": {
            "en": "Feast day",
            "es": "Día de fiesta"
          }
        },
        {
          "id": "gathering",
          "label": {
            "en": "Community gathering",
            "es": "Encuentro comunitario"
          }
        },
        {
          "id": "harvest",
          "label": {
            "en": "Harvest and fishing",
            "es": "Cosecha y pesca"
          }
        }
      ],
      "slots": {
        "invocation": [
          {
            "en": "Bless us, O Lord, and these Your gifts which we are about to receive from Your bounty.",
            "es": "Bendícenos, Señor, y bendice estos alimentos que por tu bondad vamos a recibir."
          },
          {
            "en": "Our Father, who make the sun rise on the good and the bad alike, thank You for seating us at this table today.",
            "es": "Padre nuestro, que haces salir el sol sobre buenos y malos, gracias por sentarnos hoy a esta mesa."
          },
          {
            "en": "Lord Jesus, who broke bread with Your disciples, sit down with us as well.",
            "es": "Señor Jesús, que partiste el pan con tus discípulos, siéntate también con nosotros."
          },
          {
            "en": "We praise You, God of life, for the bread on this table and for the hands that prepared it.",
            "es": "Te alabamos, Dios de la vida, por el pan de esta mesa y por las manos que lo prepararon."
          },
          {
            "en": "In the name of the Father, and of the Son, and of the Holy Spirit: bless this table, O Lord.",
            "es": "En el nombre del Padre, y del Hijo, y del Espíritu Santo: bendice, Señor, esta mesa."
          }
        ],
        "body": {
          "daily": [
            {
              "en": "Thank You for the work that placed this food on our table, and for the family that shares it.",
              "es": "Gracias por el trabajo que puso este alimento en nuestra mesa, y por la familia que lo comparte."
            },
            {
              "en": "Give us today our bread, and do not let us forget those who have none today.",
              "es": "Danos hoy nuestro pan, y no permitas que olvidemos a quienes hoy no lo tienen."
            },
            {
              "en": "May this simple meal renew our strength to serve You in others.",
              "es": "Que esta comida sencilla renueve nuestras fuerzas para servirte en los demás."
            }
          ],
          "gathering": [
            {
              "en": "Bless this gathered community: as we share bread, may we also learn to share life.",
              "es": "Bendice a esta comunidad reunida: que al compartir el pan aprendamos también a compartir la vida."
            },
            {
              "en": "Let there be no strangers at this table: make of us one single family of Yours.",
              "es": "Que en esta mesa no haya extraños: haz de nosotros una sola familia tuya."
            },
            {
              "en": "Thank You for the hands that planted, harvested, fished, and cooked what we share today.",
              "es": "Gracias por las manos que sembraron, cosecharon, pescaron y cocinaron lo que hoy compartimos."
            }
          ],
          "harvest": [
            {
              "en": "Thank You for the harvest of this land and the fruit of the sea: bless the farmers and fishers who feed us.",
              "es": "Gracias por la cosecha de esta tierra y por el fruto del mar: bendice a los campesinos y pescadores que nos alimentan."
            },
            {
              "en": "May we farm and fish with respect, so that the land and the sea keep giving life to our children.",
              "es": "Que sepamos cultivar y pescar con respeto, para que la tierra y el mar sigan dando vida a nuestros hijos."
            },
            {
              "en": "Bless the seed still in the field and the net resting on the shore: may no home lack its daily sustenance.",
              "es": "Bendice la semilla que queda en el campo y la red que descansa en la orilla: que no falte el sustento en ningún hogar."
            }
          ],
          "feast": [
            {
              "en": "On this feast day we thank You for the joy of being together and for the gifts we celebrate.",
              "es": "En este día de fiesta te damos gracias por la alegría de estar juntos y por los dones que celebramos."
            },
            {
              "en": "May the joy of this table be a foretaste of the banquet of Your Kingdom.",
              "es": "Que la alegría de esta mesa sea anticipo del banquete de tu Reino."
            },
            {
              "en": "Bless every person gathered here, and those we wish were near who are far away today.",
              "es": "Bendice a cada persona reunida aquí, y a las que quisiéramos tener cerca y hoy están lejos."
            }
          ]
        },
        "closing": [
          {
            "style": "simple",
            "tradition": "universal",
            "en": "Through Christ, our Lord. Amen.",
            "es": "Por Cristo, nuestro Señor. Amén."
          },
          {
            "style": "simple",
            "tradition": "universal",
            "en": "May the Lord bless us and these gifts, and make us sharers in the table of heaven. Amen.",
            "es": "Que el Señor nos bendiga a nosotros y a estos alimentos, y nos haga partícipes de la mesa del cielo. Amén."
          },
          {
            "style": "simple",
            "tradition": "universal",
            "en": "And may bread, peace, and faith never be lacking in this house. Amen.",
            "es": "Y que nunca falte en esta casa el pan, la paz y la fe. Amén."
          },
          {
            "style": "simple",
            "tradition": "universal",
            "en": "Provide, Lord, for the table of those who have nothing, and give us hunger and thirst for justice. Amen.",
            "es": "Provee, Señor, a la mesa del que no tiene, y danos hambre y sed de justicia. Amén."
          }
        ]
      }
    }
  },
  "traditional": [
    {
      "id": "sign-of-the-cross",
      "name": {
        "en": "Sign of the Cross",
        "es": "Señal de la Cruz"
      },
      "tradition": "universal",
      "text": {
        "en": "In the name of the Father, and of the Son, and of the Holy Spirit. Amen.",
        "es": "En el nombre del Padre, y del Hijo, y del Espíritu Santo. Amén."
      },
      "audio": {
        "speed": 0.85,
        "stability": 0.75,
        "style": 0,
        "breaks": {
          "en": [],
          "es": []
        }
      }
    },
    {
      "id": "our-father",
      "name": {
        "en": "Our Father",
        "es": "Padre Nuestro"
      },
      "tradition": "universal",
      "text": {
        "en": "Our Father, who art in heaven, hallowed be Thy name; Thy kingdom come; Thy will be done on earth as it is in heaven. Give us this day our daily bread, and forgive us our trespasses, as we forgive those who trespass against us; and lead us not into temptation, but deliver us from evil. Amen.",
        "es": "Padre nuestro, que estás en el cielo, santificado sea tu Nombre; venga a nosotros tu reino; hágase tu voluntad en la tierra como en el cielo. Danos hoy nuestro pan de cada día; perdona nuestras ofensas, como también nosotros perdonamos a los que nos ofenden; no nos dejes caer en la tentación, y líbranos del mal. Amén."
      },
      "audio": {
        "speed": 0.88,
        "stability": 0.7,
        "style": 0,
        "breaks": {
          "en": [
            {
              "after": "Thy will be done on earth as it is in heaven.",
              "seconds": 1
            },
            {
              "after": "as we forgive those who trespass against us;",
              "seconds": 0.8
            }
          ],
          "es": [
            {
              "after": "hágase tu voluntad en la tierra como en el cielo.",
              "seconds": 1
            },
            {
              "after": "no nos dejes caer en la tentación,",
              "seconds": 0.8
            }
          ]
        }
      }
    },
    {
      "id": "hail-mary",
      "name": {
        "en": "Hail Mary",
        "es": "Ave María"
      },
      "tradition": "roman-catholic",
      "text": {
        "en": "Hail Mary, full of grace, the Lord is with thee. Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.",
        "es": "Dios te salve, María, llena eres de gracia; el Señor es contigo. Bendita tú eres entre todas las mujeres, y bendito es el fruto de tu vientre, Jesús. Santa María, Madre de Dios, ruega por nosotros, pecadores, ahora y en la hora de nuestra muerte. Amén."
      },
      "audio": {
        "speed": 0.88,
        "stability": 0.7,
        "style": 0,
        "breaks": {
          "en": [
            {
              "after": "the Lord is with thee.",
              "seconds": 0.8
            }
          ],
          "es": [
            {
              "after": "el Señor es contigo.",
              "seconds": 0.8
            }
          ]
        }
      }
    },
    {
      "id": "glory-be",
      "name": {
        "en": "Glory Be",
        "es": "Gloria"
      },
      "tradition": "universal",
      "text": {
        "en": "Glory be to the Father, and to the Son, and to the Holy Spirit. As it was in the beginning, is now, and ever shall be, world without end. Amen.",
        "es": "Gloria al Padre, y al Hijo, y al Espíritu Santo. Como era en el principio, ahora y siempre, por los siglos de los siglos. Amén."
      },
      "audio": {
        "speed": 0.9,
        "stability": 0.68,
        "style": 0,
        "breaks": {
          "en": [
            {
              "after": "and to the Holy Spirit.",
              "seconds": 0.8
            }
          ],
          "es": [
            {
              "after": "y al Espíritu Santo.",
              "seconds": 0.8
            }
          ]
        }
      }
    },
    {
      "id": "apostles-creed",
      "name": {
        "en": "Apostles' Creed",
        "es": "Credo (Símbolo de los Apóstoles)"
      },
      "tradition": "universal",
      "text": {
        "en": "I believe in God, the Father almighty, Creator of heaven and earth, and in Jesus Christ, his only Son, our Lord, who was conceived by the Holy Spirit, born of the Virgin Mary, suffered under Pontius Pilate, was crucified, died and was buried; he descended into hell; on the third day he rose again from the dead; he ascended into heaven, and is seated at the right hand of God the Father almighty; from there he will come to judge the living and the dead. I believe in the Holy Spirit, the holy catholic Church, the communion of saints, the forgiveness of sins, the resurrection of the body, and life everlasting. Amen.",
        "es": "Creo en Dios, Padre todopoderoso, Creador del cielo y de la tierra. Creo en Jesucristo, su único Hijo, nuestro Señor, que fue concebido por obra y gracia del Espíritu Santo, nació de Santa María Virgen, padeció bajo el poder de Poncio Pilato, fue crucificado, muerto y sepultado, descendió a los infiernos, al tercer día resucitó de entre los muertos, subió a los cielos y está sentado a la derecha de Dios, Padre todopoderoso. Desde allí ha de venir a juzgar a los vivos y a los muertos. Creo en el Espíritu Santo, la santa Iglesia católica, la comunión de los santos, el perdón de los pecados, la resurrección de la carne y la vida eterna. Amén."
      },
      "audio": {
        "speed": 0.87,
        "stability": 0.72,
        "style": 0,
        "breaks": {
          "en": [
            {
              "after": "Creator of heaven and earth,",
              "seconds": 1
            },
            {
              "after": "born of the Virgin Mary,",
              "seconds": 0.8
            },
            {
              "after": "was crucified, died and was buried;",
              "seconds": 1
            },
            {
              "after": "on the third day he rose again from the dead;",
              "seconds": 1
            },
            {
              "after": "is seated at the right hand of God the Father almighty;",
              "seconds": 1
            }
          ],
          "es": [
            {
              "after": "Creador del cielo y de la tierra.",
              "seconds": 1
            },
            {
              "after": "nació de Santa María Virgen,",
              "seconds": 0.8
            },
            {
              "after": "fue crucificado, muerto y sepultado,",
              "seconds": 1
            },
            {
              "after": "al tercer día resucitó de entre los muertos,",
              "seconds": 1
            },
            {
              "after": "está sentado a la derecha de Dios, Padre todopoderoso.",
              "seconds": 1
            }
          ]
        }
      }
    },
    {
      "id": "hail-holy-queen",
      "name": {
        "en": "Hail Holy Queen",
        "es": "Salve (Dios te salve, Reina y Madre)"
      },
      "tradition": "roman-catholic",
      "text": {
        "en": "Hail, holy Queen, Mother of mercy, our life, our sweetness, and our hope. To thee do we cry, poor banished children of Eve. To thee do we send up our sighs, mourning and weeping in this valley of tears. Turn, then, most gracious advocate, thine eyes of mercy toward us, and after this our exile show unto us the blessed fruit of thy womb, Jesus. O clement, O loving, O sweet Virgin Mary. Pray for us, O holy Mother of God, that we may be made worthy of the promises of Christ. Amen.",
        "es": "Dios te salve, Reina y Madre de misericordia, vida, dulzura y esperanza nuestra; Dios te salve. A ti llamamos los desterrados hijos de Eva; a ti suspiramos, gimiendo y llorando en este valle de lágrimas. Ea, pues, Señora, abogada nuestra, vuelve a nosotros esos tus ojos misericordiosos; y después de este destierro, muéstranos a Jesús, fruto bendito de tu vientre. ¡Oh clementísima, oh piadosa, oh dulce siempre Virgen María! Ruega por nosotros, Santa Madre de Dios, para que seamos dignos de alcanzar las promesas de Nuestro Señor Jesucristo. Amén."
      },
      "audio": {
        "speed": 0.86,
        "stability": 0.72,
        "style": 0,
        "breaks": {
          "en": [
            {
              "after": "our life, our sweetness, and our hope.",
              "seconds": 1
            },
            {
              "after": "in this valley of tears.",
              "seconds": 1
            },
            {
              "after": "the blessed fruit of thy womb, Jesus.",
              "seconds": 1
            }
          ],
          "es": [
            {
              "after": "Dios te salve.",
              "seconds": 1
            },
            {
              "after": "en este valle de lágrimas.",
              "seconds": 1
            },
            {
              "after": "fruto bendito de tu vientre.",
              "seconds": 1
            }
          ]
        }
      }
    },
    {
      "id": "act-of-contrition",
      "name": {
        "en": "Act of Contrition",
        "es": "Acto de Contrición"
      },
      "tradition": "roman-catholic",
      "text": {
        "en": "My Lord Jesus Christ, true God and true man: I am sorry with all my heart for having sinned, because in sinning I offended You, who are the supreme good and worthy of being loved above all things. I firmly resolve, with the help of Your grace, to amend my life and avoid the occasions of sin. Amen.",
        "es": "Señor mío Jesucristo, Dios y hombre verdadero: me pesa de todo corazón haber pecado, porque pecando te ofendí a Ti, que eres el sumo bien y digno de ser amado sobre todas las cosas. Propongo firmemente, con tu gracia, enmendarme y evitar las ocasiones de pecado. Amén."
      },
      "audio": {
        "speed": 0.85,
        "stability": 0.75,
        "style": 0,
        "breaks": {
          "en": [
            {
              "after": "who are the supreme good and worthy of being loved above all things.",
              "seconds": 1
            }
          ],
          "es": [
            {
              "after": "que eres el sumo bien y digno de ser amado sobre todas las cosas.",
              "seconds": 1
            }
          ]
        }
      }
    },
    {
      "id": "angelus",
      "name": {
        "en": "Angelus",
        "es": "Ángelus"
      },
      "tradition": "roman-catholic",
      "text": {
        "en": "The Angel of the Lord declared unto Mary. And she conceived of the Holy Spirit. Hail Mary, full of grace, the Lord is with thee. Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen. Behold the handmaid of the Lord. Be it done unto me according to thy word. Hail Mary, full of grace, the Lord is with thee. Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen. And the Word was made flesh. And dwelt among us. Hail Mary, full of grace, the Lord is with thee. Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen. Pray for us, O holy Mother of God. That we may be made worthy of the promises of Christ. Let us pray: Pour forth, we beseech Thee, O Lord, Thy grace into our hearts, that we, to whom the Incarnation of Christ, Thy Son, was made known by the message of an angel, may by His Passion and Cross be brought to the glory of His Resurrection. Through the same Christ our Lord. Amen.",
        "es": "El Ángel del Señor anunció a María. Y concibió por obra y gracia del Espíritu Santo. Dios te salve, María, llena eres de gracia; el Señor es contigo. Bendita tú eres entre todas las mujeres, y bendito es el fruto de tu vientre, Jesús. Santa María, Madre de Dios, ruega por nosotros, pecadores, ahora y en la hora de nuestra muerte. Amén. He aquí la esclava del Señor. Hágase en mí según tu palabra. Dios te salve, María, llena eres de gracia; el Señor es contigo. Bendita tú eres entre todas las mujeres, y bendito es el fruto de tu vientre, Jesús. Santa María, Madre de Dios, ruega por nosotros, pecadores, ahora y en la hora de nuestra muerte. Amén. Y el Verbo se hizo carne. Y habitó entre nosotros. Dios te salve, María, llena eres de gracia; el Señor es contigo. Bendita tú eres entre todas las mujeres, y bendito es el fruto de tu vientre, Jesús. Santa María, Madre de Dios, ruega por nosotros, pecadores, ahora y en la hora de nuestra muerte. Amén. Ruega por nosotros, Santa Madre de Dios. Para que seamos dignos de alcanzar las promesas de Nuestro Señor Jesucristo. Oremos: Infunde, Señor, tu gracia en nuestras almas, para que los que hemos conocido la Encarnación de tu Hijo por la voz del Ángel lleguemos, por su Pasión y su Cruz, a la gloria de la Resurrección. Por Jesucristo, Nuestro Señor. Amén."
      },
      "audio": {
        "speed": 0.87,
        "stability": 0.7,
        "style": 0,
        "breaks": {
          "en": [
            {
              "after": "And she conceived of the Holy Spirit.",
              "seconds": 1
            },
            {
              "after": "Be it done unto me according to thy word.",
              "seconds": 1
            },
            {
              "after": "And dwelt among us.",
              "seconds": 1
            },
            {
              "after": "That we may be made worthy of the promises of Christ.",
              "seconds": 1
            }
          ],
          "es": [
            {
              "after": "Y concibió por obra y gracia del Espíritu Santo.",
              "seconds": 1
            },
            {
              "after": "Hágase en mí según tu palabra.",
              "seconds": 1
            },
            {
              "after": "Y habitó entre nosotros.",
              "seconds": 1
            },
            {
              "after": "Ruega por nosotros, Santa Madre de Dios.",
              "seconds": 1
            }
          ]
        }
      }
    },
    {
      "id": "memorare",
      "name": {
        "en": "Memorare",
        "es": "Memorare (Acuérdate)"
      },
      "tradition": "roman-catholic",
      "text": {
        "en": "Remember, O most gracious Virgin Mary, that never was it known that anyone who fled to thy protection, implored thy help, or sought thy intercession was left unaided. Inspired by this confidence, I fly unto thee, O Virgin of virgins, my Mother. To thee do I come, before thee I stand, sinful and sorrowful. O Mother of the Word Incarnate, despise not my petitions, but in thy mercy hear and answer me. Amen.",
        "es": "Acuérdate, oh piadosísima Virgen María, que jamás se ha oído decir que ninguno de los que han acudido a tu protección, implorando tu asistencia y reclamando tu socorro, haya sido abandonado de ti. Animado con esta confianza, a ti también acudo, oh Madre, Virgen de las vírgenes; y gimiendo bajo el peso de mis pecados, me atrevo a comparecer ante tu presencia soberana. No deseches mis súplicas, oh Madre del Verbo divino, antes bien, escúchalas y acógelas benignamente. Amén."
      },
      "audio": {
        "speed": 0.86,
        "stability": 0.72,
        "style": 0,
        "breaks": {
          "en": [
            {
              "after": "sought thy intercession was left unaided.",
              "seconds": 1
            }
          ],
          "es": [
            {
              "after": "haya sido abandonado de ti.",
              "seconds": 1
            }
          ]
        }
      }
    },
    {
      "id": "st-michael",
      "name": {
        "en": "Prayer to St. Michael the Archangel",
        "es": "Oración a San Miguel Arcángel"
      },
      "tradition": "roman-catholic",
      "text": {
        "en": "Saint Michael the Archangel, defend us in battle. Be our protection against the wickedness and snares of the devil. May God rebuke him, we humbly pray; and do thou, O Prince of the heavenly host, by the power of God, cast into hell Satan and all the evil spirits who prowl about the world seeking the ruin of souls. Amen.",
        "es": "San Miguel Arcángel, defiéndenos en la lucha. Sé nuestro amparo contra la perversidad y asechanzas del demonio. Reprímale Dios, pedimos suplicantes, y tú, Príncipe de la milicia celestial, arroja al infierno con el divino poder a Satanás y a los demás espíritus malignos que vagan por el mundo para la perdición de las almas. Amén."
      },
      "audio": {
        "speed": 0.9,
        "stability": 0.65,
        "style": 0,
        "breaks": {
          "en": [
            {
              "after": "wickedness and snares of the devil.",
              "seconds": 0.8
            }
          ],
          "es": [
            {
              "after": "asechanzas del demonio.",
              "seconds": 0.8
            }
          ]
        }
      }
    },
    {
      "id": "prayer-of-st-francis",
      "name": {
        "en": "Prayer of Saint Francis",
        "es": "Oración de San Francisco"
      },
      "tradition": "universal",
      "text": {
        "en": "Lord, make me an instrument of Your peace: where there is hatred, let me sow love; where there is injury, pardon; where there is discord, union; where there is doubt, faith; where there is error, truth; where there is despair, hope; where there is sadness, joy; where there is darkness, light. Amen.",
        "es": "Señor, haz de mí un instrumento de tu paz: donde haya odio, ponga yo amor; donde haya ofensa, perdón; donde haya discordia, unión; donde haya duda, fe; donde haya error, verdad; donde haya desesperación, esperanza; donde haya tristeza, alegría; donde haya tinieblas, luz. Amén."
      },
      "audio": {
        "speed": 0.88,
        "stability": 0.68,
        "style": 0,
        "breaks": {
          "en": [
            {
              "after": "where there is injury, pardon;",
              "seconds": 0.6
            },
            {
              "after": "where there is doubt, faith;",
              "seconds": 0.6
            },
            {
              "after": "where there is despair, hope;",
              "seconds": 0.6
            }
          ],
          "es": [
            {
              "after": "donde haya ofensa, perdón;",
              "seconds": 0.6
            },
            {
              "after": "donde haya duda, fe;",
              "seconds": 0.6
            },
            {
              "after": "donde haya desesperación, esperanza;",
              "seconds": 0.6
            }
          ]
        }
      }
    },
    {
      "id": "come-holy-spirit",
      "name": {
        "en": "Come, Holy Spirit",
        "es": "Ven, Espíritu Santo"
      },
      "tradition": "universal",
      "text": {
        "en": "Come, Holy Spirit, fill the hearts of your faithful and kindle in them the fire of your love. Send forth your Spirit and they shall be created. And you shall renew the face of the earth. O God, who by the light of the Holy Spirit did instruct the hearts of the faithful, grant that by the same Holy Spirit we may be truly wise and ever enjoy his consolations. Through Christ our Lord. Amen.",
        "es": "Ven, Espíritu Santo, llena los corazones de tus fieles y enciende en ellos el fuego de tu amor. Envía tu Espíritu y todo será creado. Y renovarás la faz de la tierra. Oh Dios, que instruiste los corazones de los fieles con la luz del Espíritu Santo, concédenos que apreciemos rectamente todas las cosas según ese mismo Espíritu, y gocemos siempre de su consuelo. Por Jesucristo, Nuestro Señor. Amén."
      },
      "audio": {
        "speed": 0.88,
        "stability": 0.7,
        "style": 0,
        "breaks": {
          "en": [
            {
              "after": "the fire of your love.",
              "seconds": 1
            },
            {
              "after": "they shall be created.",
              "seconds": 0.8
            }
          ],
          "es": [
            {
              "after": "el fuego de tu amor.",
              "seconds": 1
            },
            {
              "after": "todo será creado.",
              "seconds": 0.8
            }
          ]
        }
      }
    },
    {
      "id": "grace-before-meals",
      "name": {
        "en": "Traditional grace before meals",
        "es": "Bendición tradicional de la mesa"
      },
      "tradition": "universal",
      "text": {
        "en": "Bless us, O Lord, and these Thy gifts, which we are about to receive from Thy bounty. Through Christ, our Lord. Amen.",
        "es": "Bendícenos, Señor, y bendice estos alimentos que por tu bondad vamos a recibir. Por Cristo, nuestro Señor. Amén."
      }
    }
  ]
};

// Copy for the prayer surface, in both languages, so the composer is not half
// translated. Corpus content lives above; this is only the chrome around it.
const prayerUi = {
  en: {
    eyebrow: "PRAY", title: "Compose a prayer", language: "Language",
    both: "Show both languages",
    kind: "Kind", intention: "Intention", length: "Length", closing: "Closing",
    full: "Full", short: "Short", auto: "As composed",
    styles: { simple: "Simple", trinitarian: "Trinitarian", marian: "Marian", franciscan: "Franciscan" },
    romanCatholic: "Roman Catholic",
    petitionLabel: "A personal intention (optional \u2014 it stays on your device)",
    petitionPlaceholder: "Someone or something to name",
    another: "Another prayer", listen: "\u25b6 Listen", stop: "\u25a0 Stop",
    copy: "Copy", copied: "Copied", copyFailed: "Copy failed",
    combinations: "{n} prayers can be composed from this corpus for this intention.",
    close: "Close prayer composer"
  },
  es: {
    eyebrow: "ORAR", title: "Componer una oraci\u00f3n", language: "Idioma",
    both: "Mostrar ambos idiomas",
    kind: "Tipo", intention: "Intenci\u00f3n", length: "Extensi\u00f3n", closing: "Despedida",
    full: "Completa", short: "Breve", auto: "Tal como se compone",
    styles: { simple: "Sencilla", trinitarian: "Trinitaria", marian: "Mariana", franciscan: "Franciscana" },
    romanCatholic: "cat\u00f3lica romana",
    petitionLabel: "Una intenci\u00f3n personal (opcional \u2014 permanece en tu dispositivo)",
    petitionPlaceholder: "Alguien o algo que nombrar",
    another: "Otra oraci\u00f3n", listen: "\u25b6 Escuchar", stop: "\u25a0 Detener",
    copy: "Copiar", copied: "Copiado", copyFailed: "No se pudo copiar",
    combinations: "Se pueden componer {n} oraciones de este corpus para esta intenci\u00f3n.",
    close: "Cerrar el compositor de oraciones"
  }
};

if (typeof module !== "undefined" && module.exports) module.exports = { prayerCorpus, prayerUi };

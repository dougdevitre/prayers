// Prayer corpus for Stand — English only.
//
// Imported from the REMAM corpus (dougdevitre/remam,
// packages/data/content/prayers.json), which states that every composed line
// is an original composition or a universal public-domain prayer, with no
// copyrighted Bible translation quoted. Spanish, the ecological "Laudato Si'"
// slot, and the creation/defenders intentions are REMAM-specific and were not
// carried over; the "fear" and "courage" bodies are Stand's own, written in
// the same register.
//
// Shape, per REMAM: every block is a complete sentence or two, so any one
// block per slot reads as a whole prayer. Composition is deterministic and
// offline (see compose.js) — every line a user can see is reviewable here.
// Traditional items carry `audio` pacing metadata: `breaks[].after` must be an
// exact, unique substring of that prayer's text; `scripts/validate-prayers.js`
// enforces that and REMAM's generator limits.
const prayerCorpus = {
  "meta": {
    "petitionTemplate": "We entrust to You especially this intention: {petition}.",
    "reviewNote": "Draft devotional content, pending review by a pastoral advisor. Composed only from this reviewable corpus — no AI at the moment of use.",
    "review": "imported-pending-review",
    "source": "dougdevitre/remam — packages/data/content/prayers.json (English only)",
    "defaultClosingStyles": [
      "simple",
      "trinitarian"
    ],
    "defaultTraditions": [
      "universal"
    ]
  },
  "modes": {
    "prayer": {
      "name": "Prayer",
      "intentions": [
        {
          "id": "fear",
          "label": "In fear"
        },
        {
          "id": "courage",
          "label": "For courage"
        },
        {
          "id": "family",
          "label": "For the family"
        },
        {
          "id": "community",
          "label": "For the community"
        },
        {
          "id": "gratitude",
          "label": "Of gratitude"
        },
        {
          "id": "guidance",
          "label": "For guidance"
        },
        {
          "id": "sick",
          "label": "For the sick"
        }
      ],
      "slots": {
        "invocation": [
          "In the name of the Father, and of the Son, and of the Holy Spirit.",
          "God of life, Creator of heaven and earth, we come before You with open hearts.",
          "Lord Jesus, Word through whom all things were made, hear our prayer.",
          "Holy Spirit, breath of life who renews the face of the earth, come to meet us.",
          "Good Father, who look with tenderness on all You have created, look also upon us.",
          "Triune God, communion of love, gather us into Your presence."
        ],
        "body": {
          "fear": [
            "We bring You the fear we are carrying: the thoughts that will not quiet, the outcomes we cannot hold. Steady what is shaking in us, and give us peace enough for today.",
            "Lord, our fear runs ahead of us into days that have not arrived. Call us back to this hour, and give us what this hour actually asks of us.",
            "When dread wakes us and will not let us rest, remind us that You are awake, that You are not anxious, and that we are held."
          ],
          "courage": [
            "Give us courage that does not wait for the fear to pass: enough to take the next right step while we are still afraid.",
            "Make us brave in ordinary ways, Lord — the honest word, the hard call, the thing we have avoided — and let our courage serve someone besides ourselves.",
            "Strengthen all who must do something difficult today. Let them find that they are able, and let them not have to do it alone."
          ],
          "guidance": [
            "Enlighten our decisions, Lord: show us the right path and give us the humility to follow it even when it costs.",
            "When doubt holds us back, remind us that You walk with us; when weariness overcomes us, renew our strength.",
            "Give us a listening heart, to discern Your will and to serve You in our brothers and sisters."
          ],
          "sick": [
            "We bring our sick before You: lay Your hand upon them, ease their pain, sustain those who care for them, and grant them Your peace.",
            "Lord, who visited and healed the sick, accompany those who suffer in body or soul, and do not let them lose hope.",
            "Bless the hands of doctors, nurses, and caregivers, and make our community a place of comfort for those who suffer."
          ],
          "family": [
            "Bless our families: sustain fathers and mothers in their work, protect the children, accompany the grandparents, and make of every home a little church.",
            "Where there are wounds in our family, sow Your peace; where there is distance, open paths of encounter; where there is need, provide from Your abundance.",
            "May bread never be lacking at our table, and may the gratitude of sharing it never be lacking either."
          ],
          "community": [
            "We pray for our community: that we may listen to one another, work together, and bear one another's burdens.",
            "Make our parish a house with open doors, where the poor find bread, the afflicted find comfort, and the stranger finds a brother.",
            "Unite what is divided among us, and may our communion bear witness to Your Kingdom."
          ],
          "gratitude": [
            "Thank You, Lord, for the gift of this day: for the light, for our work, for our food, and for the people You placed on our path.",
            "All that we have we have received from Your hand; may our gratitude become generosity toward others.",
            "We praise You for the wonders of creation that surround us, and for the faith that sustains us on difficult days."
          ]
        },
        "closing": [
          {
            "style": "simple",
            "text": "We ask this through Jesus Christ, our Lord. Amen."
          },
          {
            "style": "marian",
            "text": "Mary, Mother of God and our Mother, pray for us. Amen."
          },
          {
            "style": "trinitarian",
            "text": "Glory be to the Father, and to the Son, and to the Holy Spirit, as it was in the beginning, is now, and ever shall be, world without end. Amen."
          },
          {
            "style": "simple",
            "text": "May the Lord bless us, keep us from all evil, and bring us to everlasting life. Amen."
          },
          {
            "style": "franciscan",
            "text": "Saint Francis of Assisi, guardian of creation, intercede for us. Amen."
          },
          {
            "style": "marian",
            "text": "Virgin of Guadalupe, patroness of our America, cover us with your mantle. Amen."
          }
        ]
      }
    },
    "forgiveness": {
      "name": "Forgiveness",
      "intentions": [
        {
          "id": "family",
          "label": "A wound in the family"
        },
        {
          "id": "community",
          "label": "A conflict in the community"
        },
        {
          "id": "receiving",
          "label": "I need to be forgiven"
        },
        {
          "id": "self",
          "label": "Forgiving myself"
        }
      ],
      "slots": {
        "invocation": [
          "God of mercy, who never tire of forgiving, I come before You just as I am.",
          "Good Father, who run to meet the returning child, receive me into Your arms.",
          "Lord Jesus, who forgave from the cross, teach me the way of forgiveness.",
          "Holy Spirit, Consoler, soften what has hardened within me.",
          "In the name of the Father, and of the Son, and of the Holy Spirit: I come seeking the peace that only You can give."
        ],
        "examen": [
          "In silence, before You, I acknowledge what has happened and what has hurt.",
          "I look at my heart truthfully: I see the wound, I see my own part in it, and I do not want to carry this alone.",
          "You know what I myself cannot even name; bring it into Your light.",
          "Give me the honesty not to excuse myself and the meekness not to condemn.",
          "Remind me how often I have been forgiven, so that I too may know how to forgive."
        ],
        "body": {
          "self": [
            "It is hard for me to forgive myself, Lord; I carry with me what I did and what I failed to do.",
            "If You, who see everything, forgive me — who am I to condemn myself without end?",
            "Teach me to see myself with Your eyes: truthfully, but also with the tenderness with which You look at me."
          ],
          "receiving": [
            "Lord, I have failed, and I do not want to hide it from You: I ask Your forgiveness with a sincere heart.",
            "Do not let shame drive me away from You; Your mercy is greater than my guilt.",
            "Give me the courage to ask forgiveness also of the one I offended, and to repair the harm where possible."
          ],
          "family": [
            "I hand over to You this wound in my family: the long silences, the words that wounded, the distance that has grown between us.",
            "Give me the grace to take the first step, though it costs me, and to speak with truth and tenderness at once.",
            "Heal what is broken in our home, and give us back the joy of sitting together at the table."
          ],
          "community": [
            "I hand over to You this conflict in our community: place Your peace where there is division, and Your truth where there is misunderstanding.",
            "Keep me from feeding resentment with my words, and make me a builder of bridges where others raise walls.",
            "May those of us who have been hurt not answer with the same harm, but with the serene firmness of the children of God."
          ]
        },
        "contrition": [
          "My God, I repent with all my heart of my failings, for in sinning I have offended You, who are the supreme good.",
          "I firmly resolve, with the help of Your grace, to amend my ways and to turn away from the occasions of doing harm.",
          "Wash me, Lord, and I shall be whiter than snow; create in me a pure heart.",
          "Like the tax collector, I dare not raise my eyes, and I only say: have mercy on me, a sinner.",
          "Grant me the grace to forgive as I wish to be forgiven — seventy times seven."
        ],
        "closing": [
          {
            "style": "simple",
            "text": "I ask this through Jesus Christ, our Lord. Amen."
          },
          {
            "style": "marian",
            "text": "Mary, Mother of mercy, accompany me on this path. Amen."
          },
          {
            "style": "simple",
            "text": "May the peace of Christ, which surpasses all understanding, guard my heart. Amen."
          },
          {
            "style": "franciscan",
            "text": "Lord, make me an instrument of Your peace: where there is offense, let me bring pardon. Amen."
          },
          {
            "style": "trinitarian",
            "text": "Glory be to the Father, and to the Son, and to the Holy Spirit. Amen."
          }
        ]
      },
      "note": "This personal prayer does not replace the sacrament of Reconciliation. If something weighs on your conscience, go to a priest: in confession the Father's embrace awaits you."
    },
    "grace": {
      "name": "Grace",
      "intentions": [
        {
          "id": "daily",
          "label": "Daily meal"
        },
        {
          "id": "feast",
          "label": "Feast day"
        },
        {
          "id": "gathering",
          "label": "Community gathering"
        },
        {
          "id": "harvest",
          "label": "Harvest and fishing"
        }
      ],
      "slots": {
        "invocation": [
          "Bless us, O Lord, and these Your gifts which we are about to receive from Your bounty.",
          "Our Father, who make the sun rise on the good and the bad alike, thank You for seating us at this table today.",
          "Lord Jesus, who broke bread with Your disciples, sit down with us as well.",
          "We praise You, God of life, for the bread on this table and for the hands that prepared it.",
          "In the name of the Father, and of the Son, and of the Holy Spirit: bless this table, O Lord."
        ],
        "body": {
          "daily": [
            "Thank You for the work that placed this food on our table, and for the family that shares it.",
            "Give us today our bread, and do not let us forget those who have none today.",
            "May this simple meal renew our strength to serve You in others."
          ],
          "gathering": [
            "Bless this gathered community: as we share bread, may we also learn to share life.",
            "Let there be no strangers at this table: make of us one single family of Yours.",
            "Thank You for the hands that planted, harvested, fished, and cooked what we share today."
          ],
          "harvest": [
            "Thank You for the harvest of this land and the fruit of the sea: bless the farmers and fishers who feed us.",
            "May we farm and fish with respect, so that the land and the sea keep giving life to our children.",
            "Bless the seed still in the field and the net resting on the shore: may no home lack its daily sustenance."
          ],
          "feast": [
            "On this feast day we thank You for the joy of being together and for the gifts we celebrate.",
            "May the joy of this table be a foretaste of the banquet of Your Kingdom.",
            "Bless every person gathered here, and those we wish were near who are far away today."
          ]
        },
        "closing": [
          {
            "style": "simple",
            "text": "Through Christ, our Lord. Amen."
          },
          {
            "style": "simple",
            "text": "May the Lord bless us and these gifts, and make us sharers in the table of heaven. Amen."
          },
          {
            "style": "simple",
            "text": "And may bread, peace, and faith never be lacking in this house. Amen."
          },
          {
            "style": "simple",
            "text": "Provide, Lord, for the table of those who have nothing, and give us hunger and thirst for justice. Amen."
          }
        ]
      }
    }
  },
  "traditional": [
    {
      "id": "sign-of-the-cross",
      "name": "Sign of the Cross",
      "tradition": "universal",
      "text": "In the name of the Father, and of the Son, and of the Holy Spirit. Amen.",
      "audio": {
        "speed": 0.85,
        "stability": 0.75,
        "style": 0,
        "breaks": []
      }
    },
    {
      "id": "our-father",
      "name": "Our Father",
      "tradition": "universal",
      "text": "Our Father, who art in heaven, hallowed be Thy name; Thy kingdom come; Thy will be done on earth as it is in heaven. Give us this day our daily bread, and forgive us our trespasses, as we forgive those who trespass against us; and lead us not into temptation, but deliver us from evil. Amen.",
      "audio": {
        "speed": 0.88,
        "stability": 0.7,
        "style": 0,
        "breaks": [
          {
            "after": "Thy will be done on earth as it is in heaven.",
            "seconds": 1
          },
          {
            "after": "as we forgive those who trespass against us;",
            "seconds": 0.8
          }
        ]
      }
    },
    {
      "id": "hail-mary",
      "name": "Hail Mary",
      "tradition": "catholic",
      "text": "Hail Mary, full of grace, the Lord is with thee. Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.",
      "audio": {
        "speed": 0.88,
        "stability": 0.7,
        "style": 0,
        "breaks": [
          {
            "after": "the Lord is with thee.",
            "seconds": 0.8
          }
        ]
      }
    },
    {
      "id": "glory-be",
      "name": "Glory Be",
      "tradition": "universal",
      "text": "Glory be to the Father, and to the Son, and to the Holy Spirit. As it was in the beginning, is now, and ever shall be, world without end. Amen.",
      "audio": {
        "speed": 0.9,
        "stability": 0.68,
        "style": 0,
        "breaks": [
          {
            "after": "and to the Holy Spirit.",
            "seconds": 0.8
          }
        ]
      }
    },
    {
      "id": "apostles-creed",
      "name": "Apostles' Creed",
      "tradition": "universal",
      "text": "I believe in God, the Father almighty, Creator of heaven and earth, and in Jesus Christ, his only Son, our Lord, who was conceived by the Holy Spirit, born of the Virgin Mary, suffered under Pontius Pilate, was crucified, died and was buried; he descended into hell; on the third day he rose again from the dead; he ascended into heaven, and is seated at the right hand of God the Father almighty; from there he will come to judge the living and the dead. I believe in the Holy Spirit, the holy catholic Church, the communion of saints, the forgiveness of sins, the resurrection of the body, and life everlasting. Amen.",
      "audio": {
        "speed": 0.87,
        "stability": 0.72,
        "style": 0,
        "breaks": [
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
        ]
      }
    },
    {
      "id": "hail-holy-queen",
      "name": "Hail Holy Queen",
      "tradition": "catholic",
      "text": "Hail, holy Queen, Mother of mercy, our life, our sweetness, and our hope. To thee do we cry, poor banished children of Eve. To thee do we send up our sighs, mourning and weeping in this valley of tears. Turn, then, most gracious advocate, thine eyes of mercy toward us, and after this our exile show unto us the blessed fruit of thy womb, Jesus. O clement, O loving, O sweet Virgin Mary. Pray for us, O holy Mother of God, that we may be made worthy of the promises of Christ. Amen.",
      "audio": {
        "speed": 0.86,
        "stability": 0.72,
        "style": 0,
        "breaks": [
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
        ]
      }
    },
    {
      "id": "act-of-contrition",
      "name": "Act of Contrition",
      "tradition": "catholic",
      "text": "My Lord Jesus Christ, true God and true man: I am sorry with all my heart for having sinned, because in sinning I offended You, who are the supreme good and worthy of being loved above all things. I firmly resolve, with the help of Your grace, to amend my life and avoid the occasions of sin. Amen.",
      "audio": {
        "speed": 0.85,
        "stability": 0.75,
        "style": 0,
        "breaks": [
          {
            "after": "who are the supreme good and worthy of being loved above all things.",
            "seconds": 1
          }
        ]
      }
    },
    {
      "id": "angelus",
      "name": "Angelus",
      "tradition": "catholic",
      "text": "The Angel of the Lord declared unto Mary. And she conceived of the Holy Spirit. Hail Mary, full of grace, the Lord is with thee. Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen. Behold the handmaid of the Lord. Be it done unto me according to thy word. Hail Mary, full of grace, the Lord is with thee. Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen. And the Word was made flesh. And dwelt among us. Hail Mary, full of grace, the Lord is with thee. Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen. Pray for us, O holy Mother of God. That we may be made worthy of the promises of Christ. Let us pray: Pour forth, we beseech Thee, O Lord, Thy grace into our hearts, that we, to whom the Incarnation of Christ, Thy Son, was made known by the message of an angel, may by His Passion and Cross be brought to the glory of His Resurrection. Through the same Christ our Lord. Amen.",
      "audio": {
        "speed": 0.87,
        "stability": 0.7,
        "style": 0,
        "breaks": [
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
        ]
      }
    },
    {
      "id": "memorare",
      "name": "Memorare",
      "tradition": "catholic",
      "text": "Remember, O most gracious Virgin Mary, that never was it known that anyone who fled to thy protection, implored thy help, or sought thy intercession was left unaided. Inspired by this confidence, I fly unto thee, O Virgin of virgins, my Mother. To thee do I come, before thee I stand, sinful and sorrowful. O Mother of the Word Incarnate, despise not my petitions, but in thy mercy hear and answer me. Amen.",
      "audio": {
        "speed": 0.86,
        "stability": 0.72,
        "style": 0,
        "breaks": [
          {
            "after": "sought thy intercession was left unaided.",
            "seconds": 1
          }
        ]
      }
    },
    {
      "id": "st-michael",
      "name": "Prayer to St. Michael the Archangel",
      "tradition": "catholic",
      "text": "Saint Michael the Archangel, defend us in battle. Be our protection against the wickedness and snares of the devil. May God rebuke him, we humbly pray; and do thou, O Prince of the heavenly host, by the power of God, cast into hell Satan and all the evil spirits who prowl about the world seeking the ruin of souls. Amen.",
      "audio": {
        "speed": 0.9,
        "stability": 0.65,
        "style": 0,
        "breaks": [
          {
            "after": "wickedness and snares of the devil.",
            "seconds": 0.8
          }
        ]
      }
    },
    {
      "id": "prayer-of-st-francis",
      "name": "Prayer of Saint Francis",
      "tradition": "universal",
      "text": "Lord, make me an instrument of Your peace: where there is hatred, let me sow love; where there is injury, pardon; where there is discord, union; where there is doubt, faith; where there is error, truth; where there is despair, hope; where there is sadness, joy; where there is darkness, light. Amen.",
      "audio": {
        "speed": 0.88,
        "stability": 0.68,
        "style": 0,
        "breaks": [
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
        ]
      }
    },
    {
      "id": "come-holy-spirit",
      "name": "Come, Holy Spirit",
      "tradition": "universal",
      "text": "Come, Holy Spirit, fill the hearts of your faithful and kindle in them the fire of your love. Send forth your Spirit and they shall be created. And you shall renew the face of the earth. O God, who by the light of the Holy Spirit did instruct the hearts of the faithful, grant that by the same Holy Spirit we may be truly wise and ever enjoy his consolations. Through Christ our Lord. Amen.",
      "audio": {
        "speed": 0.88,
        "stability": 0.7,
        "style": 0,
        "breaks": [
          {
            "after": "the fire of your love.",
            "seconds": 1
          },
          {
            "after": "they shall be created.",
            "seconds": 0.8
          }
        ]
      }
    },
    {
      "id": "grace-before-meals",
      "name": "Traditional grace before meals",
      "tradition": "universal",
      "text": "Bless us, O Lord, and these Thy gifts, which we are about to receive from Thy bounty. Through Christ, our Lord. Amen."
    }
  ]
};

if (typeof module !== "undefined" && module.exports) module.exports = { prayerCorpus };

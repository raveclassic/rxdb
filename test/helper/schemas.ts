import AsyncTestUtil from 'async-test-util';

import type {
    RxJsonSchema
} from '../../plugins/core';
import {
    HumanDocumentType,
    SimpleHumanV3DocumentType,
    HumanWithSubOtherDocumentType,
    NestedHumanDocumentType,
    DeepNestedHumanDocumentType,
    EncryptedHumanDocumentType,
    EncryptedObjectHumanDocumentType,
    EncryptedDeepHumanDocumentType,
    CompoundIndexDocumentType,
    CompoundIndexNoStringDocumentType,
    HeroArrayDocumentType,
    SimpleHeroArrayDocumentType,
    AgeHumanDocumentType,
    RefHumanDocumentType,
    RefHumanNestedDocumentType,
    AverageSchemaDocumentType,
    PointDocumentType,
    HumanWithTimestampDocumentType,
    BigHumanDocumentType,
    NostringIndexDocumentType,
    NoIndexHumanDocumentType,
    HumanWithCompositePrimary
} from './schema-objects';

export const human: RxJsonSchema<HumanDocumentType> = {
    title: 'human schema',
    description: 'describes a human being',
    version: 0,
    keyCompression: true,
    primaryKey: 'passportId',
    type: 'object',
    properties: {
        passportId: {
            type: 'string'
        },
        firstName: {
            type: 'string'
        },
        lastName: {
            type: 'string'
        },
        age: {
            description: 'age in years',
            type: 'integer',
            minimum: 0,
            maximum: 150
        }
    },
    required: ['firstName', 'lastName'],
    indexes: ['firstName']
};

export const humanDefault: RxJsonSchema<HumanDocumentType> = {
    title: 'human schema',
    version: 0,
    description: 'describes a human being',
    keyCompression: true,
    primaryKey: 'passportId',
    type: 'object',
    properties: {
        passportId: {
            type: 'string'
        },
        firstName: {
            type: 'string'
        },
        lastName: {
            type: 'string'
        },
        age: {
            description: 'age in years',
            type: 'integer',
            minimum: 0,
            maximum: 150,
            default: 20
        }
    },
    indexes: [],
    required: ['passportId']
};

export const humanFinal: RxJsonSchema<HumanDocumentType> = {
    title: 'human schema with age set final',
    version: 0,
    keyCompression: true,
    type: 'object',
    primaryKey: 'passportId',
    properties: {
        passportId: {
            type: 'string'
        },
        firstName: {
            type: 'string'
        },
        lastName: {
            type: 'string'
        },
        age: {
            type: 'integer',
            minimum: 0,
            maximum: 150,
            final: true
        }
    },
    required: [
        'passportId'
    ]
};

export const simpleHuman: RxJsonSchema<SimpleHumanV3DocumentType> = {
    title: 'human schema',
    version: 0,
    keyCompression: true,
    description: 'describes a simple human being',
    primaryKey: 'passportId',
    type: 'object',
    properties: {
        passportId: {
            type: 'string'
        },
        age: {
            type: 'string'
        }
    },
    indexes: ['age'],
    required: ['passportId', 'age']
};

export const simpleHumanV3: RxJsonSchema<SimpleHumanV3DocumentType> = {
    title: 'human schema',
    version: 3,
    keyCompression: true,
    description: 'describes a simple human being',
    type: 'object',
    primaryKey: 'passportId',
    properties: {
        passportId: {
            type: 'string'
        },
        age: {
            type: 'number'
        }
    },
    indexes: ['age'],
    required: ['passportId', 'age']
};

export const humanAgeIndex: RxJsonSchema<HumanDocumentType> = {
    title: 'human schema',
    version: 0,
    keyCompression: true,
    description: 'describes a human being',
    primaryKey: 'passportId',
    type: 'object',
    properties: {
        passportId: {
            type: 'string'
        },
        firstName: {
            type: 'string'
        },
        lastName: {
            type: 'string'
        },
        age: {
            description: 'Age in years',
            type: 'integer',
            minimum: 0,
            maximum: 150
        }
    },
    required: ['firstName', 'lastName', 'age'],
    indexes: ['age']
};

export const humanArrayIndex: RxJsonSchema<{ passportId: string; jobs: { name: string }[] }> = {
    title: 'human schema',
    version: 0,
    keyCompression: true,
    description: 'describes a human being',
    primaryKey: 'passportId',
    type: 'object',
    properties: {
        passportId: {
            type: 'string'
        },
        jobs: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    name: {
                        type: 'string'
                    }
                }
            }
        }
    },
    required: [],
    indexes: ['jobs.[].name']
};

export const humanSubIndex: RxJsonSchema<HumanWithSubOtherDocumentType> = {
    title: 'human schema',
    version: 0,
    description: 'describes a human being where other.age is index',
    keyCompression: true,
    primaryKey: 'passportId',
    type: 'object',
    properties: {
        passportId: {
            type: 'string'
        },
        other: {
            type: 'object',
            properties: {
                age: {
                    description: 'Age in years',
                    type: 'integer',
                    minimum: 0,
                    maximum: 150
                }
            }
        }
    },
    required: [
        'passportId'
    ],
    indexes: ['other.age']
};

/**
 * each field is an index,
 * use this to slow down inserts in tests
 */
export const humanWithAllIndex: RxJsonSchema<HumanDocumentType> = {
    title: 'human schema',
    description: 'describes a human being',
    version: 0,
    keyCompression: true,
    primaryKey: 'passportId',
    type: 'object',
    properties: {
        passportId: {
            type: 'string'
        },
        firstName: {
            type: 'string'
        },
        lastName: {
            type: 'string'
        },
        age: {
            description: 'age in years',
            type: 'integer',
            minimum: 0,
            maximum: 150
        }
    },
    indexes: ['firstName', 'lastName', 'age'],
    required: ['firstName', 'lastName']
};

export const nestedHuman: RxJsonSchema<NestedHumanDocumentType> = {
    title: 'human nested',
    version: 0,
    description: 'describes a human being with a nested field',
    keyCompression: true,
    primaryKey: 'passportId',
    type: 'object',
    properties: {
        passportId: {
            type: 'string'
        },
        firstName: {
            type: 'string'
        },
        mainSkill: {
            type: 'object',
            properties: {
                name: {
                    type: 'string'
                },
                level: {
                    type: 'number',
                    minimum: 0,
                    maximum: 10
                }
            },
            required: ['name', 'level']
        }
    },
    required: ['firstName'],
    indexes: []
};

export const deepNestedHuman: RxJsonSchema<DeepNestedHumanDocumentType> = {
    title: 'deep human nested',
    version: 0,
    keyCompression: true,
    description: 'describes a human being with a nested field',
    primaryKey: 'passportId',
    type: 'object',
    properties: {
        passportId: {
            type: 'string'
        },
        mainSkill: {
            type: 'object',
            properties: {
                name: {
                    type: 'string'
                },
                attack: {
                    type: 'object',
                    properties: {
                        good: {
                            type: 'boolean'
                        },
                        count: {
                            type: 'number'
                        }
                    }
                }
            },
            required: ['name']
        }
    },
    indexes: [],
    required: ['mainSkill']
};

export const noIndexHuman: RxJsonSchema<NoIndexHumanDocumentType> = {
    title: 'human schema',
    version: 0,
    description: 'this schema has no index',
    keyCompression: true,
    primaryKey: 'firstName',
    type: 'object',
    properties: {
        firstName: {
            type: 'string'
        },
        lastName: {
            type: 'string'
        }
    },
    required: ['lastName']
};

export const noStringIndex: RxJsonSchema<NostringIndexDocumentType> = {
    description: 'the index has no type:string',
    version: 0,
    keyCompression: true,
    primaryKey: 'passportId',
    type: 'object',
    properties: {
        passportId: {
            type: 'object'
        },
        firstName: {
            type: 'string'
        }
    },
    required: ['firstName', 'passportId'],
    indexes: []
};


export const bigHuman: RxJsonSchema<BigHumanDocumentType> = {
    title: 'human schema',
    version: 0,
    description: 'describes a human being with 2 indexes',
    keyCompression: true,
    primaryKey: 'passportId',
    type: 'object',
    properties: {
        passportId: {
            type: 'string'
        },
        dnaHash: {
            type: 'string'
        },
        firstName: {
            type: 'string'
        },
        lastName: {
            type: 'string'
        },
        age: {
            description: 'Age in years',
            type: 'integer',
            minimum: 0
        }
    },
    required: ['firstName', 'lastName'],
    indexes: ['firstName', 'dnaHash']
};

export const encryptedHuman: RxJsonSchema<EncryptedHumanDocumentType> = {
    title: 'human encrypted',
    version: 0,
    description: 'uses an encrypted field',
    primaryKey: 'passportId',
    type: 'object',
    keyCompression: true,
    properties: {
        passportId: {
            type: 'string'
        },
        firstName: {
            type: 'string'
        },
        secret: {
            type: 'string'
        }
    },
    indexes: [],
    required: ['firstName', 'secret'],
    encrypted: ['secret']
};

export const encryptedObjectHuman: RxJsonSchema<EncryptedObjectHumanDocumentType> = {
    title: 'human encrypted',
    version: 0,
    keyCompression: true,
    description: 'uses an encrypted field',
    primaryKey: 'passportId',
    type: 'object',
    properties: {
        passportId: {
            type: 'string'
        },
        firstName: {
            type: 'string'
        },
        secret: {
            type: 'object',
            properties: {
                name: {
                    type: 'string'
                },
                subname: {
                    type: 'string'
                }
            }
        }
    },
    indexes: [],
    required: ['firstName', 'secret'],
    encrypted: ['secret']
};

export const encryptedDeepHuman: RxJsonSchema<EncryptedDeepHumanDocumentType> = {
    title: 'human encrypted',
    version: 0,
    keyCompression: true,
    description: 'uses an encrypted field',
    primaryKey: 'passportId',
    type: 'object',
    properties: {
        passportId: {
            type: 'string'
        },
        firstName: {
            type: 'string'
        },
        firstLevelPassword: {
            type: 'string',
        },
        secretData: {
            type: 'object',
            properties: {
                pw: {
                    type: 'string'
                }
            }
        },
        deepSecret: {
            type: 'object',
            properties: {
                darkhole: {
                    type: 'object',
                    properties: {
                        pw: {
                            type: 'string'
                        }
                    }
                }
            }
        },
        nestedSecret: {
            type: 'object',
            properties: {
                darkhole: {
                    type: 'object',
                    properties: {
                        pw: {
                            type: 'string'
                        }
                    }
                }
            }
        }

    },
    indexes: [],
    required: ['firstName', 'secretData'],
    encrypted: [
        'firstLevelPassword',
        'secretData',
        'deepSecret.darkhole.pw',
        'nestedSecret.darkhole.pw'
    ]
};

export const notExistingIndex: RxJsonSchema<{ passportId: string; address: { street: string } }> = {
    title: 'index',
    version: 0,
    description: 'this schema has a specified index which does not exists',
    primaryKey: 'passportId',
    type: 'object',
    keyCompression: true,
    properties: {
        passportId: {
            type: 'string'
        },
        address: {
            type: 'object',
            properties: {
                street: { type: 'string' }
            }
        }
    },
    required: [
        'passportId'
    ],
    indexes: ['address.apartment']
};

export const compoundIndex: RxJsonSchema<CompoundIndexDocumentType> = {
    title: 'compund index',
    version: 0,
    description: 'this schema has a compoundIndex',
    primaryKey: 'passportId',
    type: 'object',
    keyCompression: true,
    properties: {
        passportId: {
            type: 'string'
        },
        passportCountry: {
            type: 'string'
        },
        age: {
            type: 'integer'
        }
    },
    required: [
        'passportId'
    ],
    indexes: [
        ['age', 'passportCountry']
    ]
};

export const compoundIndexNoString: RxJsonSchema<CompoundIndexNoStringDocumentType> = {
    title: 'compound index',
    version: 0,
    description: 'this schema has a compoundIndex',
    primaryKey: 'passportId',
    keyCompression: true,
    type: 'object',
    properties: {
        passportId: {
            type: 'string'
        },
        passportCountry: {
            type: 'object'
        },
        age: {
            type: 'integer'
        }
    },
    indexes: [
        [10, 'passportCountry']
    ]
} as RxJsonSchema<CompoundIndexNoStringDocumentType>;

export const wrongCompoundFormat: RxJsonSchema<CompoundIndexDocumentType> = {
    title: 'compund index',
    version: 0,
    description: 'this schema has a compoundIndex',
    keyCompression: true,
    primaryKey: 'passportId',
    type: 'object',
    properties: {
        passportId: {
            type: 'string'
        },
        passportCountry: {
            type: 'string'
        },
        age: {
            type: 'integer'
        }
    },
    required: [
        'passportId'
    ],
    compoundIndexes: [{
        foo: 'bar'
    }]
} as RxJsonSchema<CompoundIndexDocumentType>;

export const empty: RxJsonSchema<any> = {
    title: 'empty schema',
    version: 0,
    type: 'object',
    primaryKey: 'id',
    properties: {
        id: {
            type: 'string'
        }
    },
    required: ['id']
};

export const heroArray: RxJsonSchema<HeroArrayDocumentType> = {
    title: 'hero schema',
    version: 0,
    keyCompression: true,
    description: 'describes a hero with an array-field',
    primaryKey: 'name',
    type: 'object',
    properties: {
        name: {
            type: 'string'
        },
        skills: {
            type: 'array',
            maxItems: 5,
            uniqueItems: true,
            items: {
                type: 'object',
                properties: {
                    name: {
                        type: 'string'
                    },
                    damage: {
                        type: 'number'
                    }
                }
            }
        }
    },
    required: [
        'name'
    ]
};

export const simpleArrayHero: RxJsonSchema<SimpleHeroArrayDocumentType> = {
    title: 'hero schema',
    version: 0,
    description: 'describes a hero with a string-array-field',
    keyCompression: true,
    primaryKey: 'name',
    type: 'object',
    properties: {
        name: {
            type: 'string'
        },
        skills: {
            type: 'array',
            maxItems: 5,
            uniqueItems: true,
            items: {
                type: 'string',
            }
        }
    },
    required: [
        'name'
    ]
};

export const primaryHuman: RxJsonSchema<HumanDocumentType> = {
    title: 'human schema with primary',
    version: 0,
    description: 'describes a human being with passsportID as primary',
    keyCompression: true,
    primaryKey: 'passportId',
    type: 'object',
    properties: {
        passportId: {
            type: 'string',
            minLength: 4
        },
        firstName: {
            type: 'string'
        },
        lastName: {
            type: 'string'
        },
        age: {
            type: 'integer',
            minimum: 0,
            maximum: 150
        }
    },
    required: ['firstName', 'lastName']
};

export const humanNormalizeSchema1: RxJsonSchema<AgeHumanDocumentType> = {
    title: 'human schema',
    version: 0,
    keyCompression: true,
    description: 'describes a human being',
    primaryKey: 'passportId',
    type: 'object',
    properties: {
        passportId: {
            type: 'string',
            minLength: 4
        },
        age: {
            description: 'age in years',
            type: 'integer',
            minimum: 0,
            maximum: 150
        }
    },
    required: ['age', 'passportId']
};

export const humanNormalizeSchema2: RxJsonSchema<AgeHumanDocumentType> = {
    title: 'human schema',
    version: 0,
    keyCompression: true,
    primaryKey: 'passportId',
    type: 'object',
    properties: {
        passportId: {
            type: 'string',
            minLength: 4
        },
        age: {
            minimum: 0,
            type: 'integer',
            description: 'age in years',
            maximum: 150
        }
    },
    description: 'describes a human being',
    required: ['age', 'passportId']
};

export const refHuman: RxJsonSchema<RefHumanDocumentType> = {
    title: 'human related to other human',
    version: 0,
    keyCompression: true,
    primaryKey: 'name',
    type: 'object',
    properties: {
        name: {
            type: 'string'
        },
        bestFriend: {
            ref: 'human',
            type: 'string'
        }
    },
    required: [
        'name'
    ]
};

export const humanCompositePrimary: RxJsonSchema<HumanWithCompositePrimary> = {
    title: 'human schema',
    description: 'describes a human being',
    version: 0,
    keyCompression: true,
    primaryKey: {
        key: 'id',
        fields: [
            'firstName',
            'info.age'
        ],
        separator: '|'
    },
    type: 'object',
    properties: {
        id: {
            type: 'string'
        },
        firstName: {
            type: 'string'
        },
        lastName: {
            type: 'string'
        },
        info: {
            type: 'object',
            properties: {
                age: {
                    description: 'age in years',
                    type: 'integer',
                    minimum: 0,
                    maximum: 150
                }
            },
            required: ['age']
        }
    },
    required: [
        'id',
        'firstName',
        'lastName',
        'info'
    ],
    indexes: ['firstName']
};

export const refHumanNested: RxJsonSchema<RefHumanNestedDocumentType> = {
    title: 'human related to other human',
    version: 0,
    keyCompression: true,
    primaryKey: 'name',
    type: 'object',
    properties: {
        name: {
            type: 'string'
        },
        foo: {
            type: 'object',
            properties: {
                bestFriend: {
                    ref: 'human',
                    type: 'string'
                }
            }
        }
    },
    required: [
        'name'
    ]
};

/**
 * an average schema used in performance-tests
 */
export function averageSchema(): RxJsonSchema<AverageSchemaDocumentType> {
    const ret: RxJsonSchema<AverageSchemaDocumentType> = {
        title: 'averageSchema_' + AsyncTestUtil.randomString(5), // randomisation used so hash differs
        version: 0,
        primaryKey: 'id',
        type: 'object',
        keyCompression: true,
        properties: {
            id: {
                type: 'string'
            },
            var1: {
                type: 'string'
            },
            var2: {
                type: 'number',
            },
            deep: {
                type: 'object',
                properties: {
                    deep1: {
                        type: 'string'
                    },
                    deep2: {
                        type: 'string'
                    }
                }
            },
            list: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        deep1: {
                            type: 'string'
                        },
                        deep2: {
                            type: 'string'
                        }
                    }
                }
            }
        },
        required: [
            'id'
        ],
        indexes: [
            'var1',
            'deep.deep1',
            // one compound index
            [
                'var2',
                'var1'
            ]
        ]
    };
    return ret;
}

export const point: RxJsonSchema<PointDocumentType> = {
    title: 'point schema',
    version: 0,
    description: 'describes coordinates in 2d space',
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: {
            type: 'string'
        },
        x: {
            type: 'number'
        },
        y: {
            type: 'number'
        }
    },
    required: ['x', 'y']
};

export const humanMinimal: RxJsonSchema<SimpleHumanV3DocumentType> = {
    title: 'human schema',
    description: 'describes a human being',
    version: 0,
    keyCompression: true,
    primaryKey: 'passportId',
    type: 'object',
    properties: {
        passportId: {
            type: 'string'
        },
        age: {
            type: 'integer'
        }
    },
    indexes: [],
    required: ['passportId', 'age']
};

export const humanMinimalBroken: RxJsonSchema<{ passportId: string; broken: number }> = {
    title: 'human schema',
    description: 'describes a human being',
    version: 0,
    keyCompression: true,
    primaryKey: 'passportId',
    type: 'object',
    properties: {
        passportId: {
            type: 'string'
        },
        broken: {
            type: 'integer'
        }
    },
    indexes: [],
    required: ['passportId', 'broken']
} as unknown as RxJsonSchema<any>;


/**
 * used in the graphql-test
 * contains timestamp
 */
export const humanWithTimestamp: RxJsonSchema<HumanWithTimestampDocumentType> = {
    version: 0,
    type: 'object',
    primaryKey: 'id',
    properties: {
        id: {
            type: 'string'
        },
        name: {
            type: 'string'
        },
        age: {
            type: 'number'
        },
        updatedAt: {
            type: 'number'
        }
    },
    required: ['id', 'name', 'age', 'updatedAt']
};

/**
 * each field is an index,
 * use this to slow down inserts in tests
 */
export const humanWithTimestampAllIndex: RxJsonSchema<HumanWithTimestampDocumentType> = {
    version: 0,
    type: 'object',
    primaryKey: 'id',
    properties: {
        id: {
            type: 'string'
        },
        name: {
            type: 'string'
        },
        age: {
            type: 'number'
        },
        updatedAt: {
            type: 'number'
        }
    },
    indexes: ['name', 'age', 'updatedAt'],
    required: ['id', 'name', 'age', 'updatedAt']
};

export const humanWithSimpleAndCompoundIndexes: RxJsonSchema<{ id: string; name: string; age: number; createdAt: number; updatedAt: number }> = {
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: {
            type: 'string'
        },
        name: {
            type: 'string'
        },
        age: {
            type: 'number'
        },
        createdAt: {
            type: 'number'
        },
        updatedAt: {
            type: 'number'
        }
    },
    indexes: ['name', 'age', ['createdAt', 'updatedAt']],
    required: ['id', 'name', 'age', 'updatedAt']
};

export const humanWithDeepNestedIndexes: RxJsonSchema<{ id: string; name: string; job: any }> = {
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: {
            type: 'string'
        },
        name: {
            type: 'string'
        },
        job: {
            type: 'object',
            properties: {
                name: {
                    type: 'string'
                },
                manager: {
                    type: 'object',
                    properties: {
                        fullName: {
                            type: 'string'
                        },
                        previousJobs: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    name: {
                                        type: 'string'
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    required: [
        'id'
    ],
    indexes: ['name', 'job.name', 'job.manager.fullName', 'job.manager.previousJobs.[].name']
};

export const humanIdAndAgeIndex: RxJsonSchema<{ id: string; name: string; age: number }> = {
    version: 0,
    description: 'uses a compound index with id as lowest level',
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: {
            type: 'string'
        },
        name: {
            type: 'string'
        },
        age: {
            description: 'Age in years',
            type: 'integer',
            minimum: 0,
            maximum: 150
        }
    },
    required: ['id', 'name', 'age'],
    indexes: [
        ['age', 'id']
    ]
};

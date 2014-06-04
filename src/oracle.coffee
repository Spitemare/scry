splitRegex = /(.*?)\s?\/\/?\s?(.*)/

getQueryName = (s) ->
    return s.replace(/Æ/gi, 'AE').replace(/[^\s\w]/gi, '').toUpperCase()

notify = ->
    $.Deferred((dfd) ->
        chrome.notifications.create '', {
            type : 'basic',
            title : 'Updating Card Database',
            message : 'Please wait...',
            iconUrl : 'img/icon-128.png'
        }, dfd.resolve
    ).promise()

getVersion = ->
    $.Deferred((dfd) ->
        chrome.storage.local.get { version : 1 }, (items) ->
            dfd.resolve items.version
    ).promise()

fetchOracle = ->
    $.Deferred((dfd) ->
        $.ajax({
            dataType : 'json',
            url : 'http://mtgjson.com/json/AllSets.json',
            cache : false
        }).done (data) -> dfd.resolve data
    ).promise()

processCard = (set, card) ->
    existing = this[card.name] ? {}
    card.queryname = getQueryName(card.name)
    card.sets = existing.sets ? []
    card.sets.unshift {
        artist : card.artist
        border : card.border ? set.border
        flavor : card.flavor
        image : card.imageName
        multiverseid : card.multiverseid
        number : card.number
        rarity : card.rarity
        setcode : set.code
        setname : set.name
    }
    card.multiverseids = existing.multiverseids ? []
    card.multiverseids.unshift card.multiverseid
    delete card.artist
    delete card.border
    delete card.flavor
    delete card.foreignNames
    delete card.imageName
    delete card.multiverseid
    delete card.number
    delete card.originalText
    delete card.originalType
    delete card.printings
    delete card.rarity
    delete card.variations
    delete card.watermark
    this[card.name] = card

processSet = (set) ->
    processCard.call this, set, card for card in set.cards

storeCard = (card) ->
    this.put(card)

updateDB  = (nid, version, sets) ->
    $.indexedDB('oracle', {
        version : version
        schema : {
            1 : (transaction) ->
                transaction.createObjectStore('cards', {
                    autoIncrement : false,
                    keyPath : 'queryname'
                }).createIndex 'multiverseids', { multiEntry : true }
        },
        upgrade : (transaction) ->
            transaction.objectStore('cards').clear()
            cards = {}
            processSet.call cards, set for code, set of sets
            store = transaction.objectStore 'cards'
            storeCard.call store, card for name, card of cards
    }).done -> chrome.notifications.clear nid, $.noop

chrome.storage.onChanged.addListener (changes) ->
    return unless changes.version? and changes.version.oldValue != changes.version.newValue
    $.when(notify(), getVersion(), fetchOracle()).done updateDB

selectSet = (msg, card) ->
    if (msg.multiverseid) then return set for set in card.sets when set.multiverseid == msg.multiverseid
    return card.sets[0] unless msg.setcode?
    return set for set in card.sets when set.setcode == msg.setcode

prune = (card) ->
    delete card.multiverseids
    delete card.queryname
    return card

findOther = (card) ->
    return $.Deferred((dfd) ->
        return dfd.resolve card unless card.names
        otherName = getQueryName (name for name in card.names when name != card.name)[0]
        $.indexedDB('oracle').objectStore('cards', false).get(otherName).done (other) ->
            $.extend true, other, selectSet(card.setcode, other)
            card.other = prune(other)
            dfd.resolve card
    ).promise()

buildQuery = (msg) ->
    if msg.multiverseid then return msg.multiverseid
    if splitRegex.test(msg.name) then return getQueryName splitRegex.exec(msg.name)[1]
    return getQueryName msg.name


chrome.runtime.onMessage.addListener (msg, sender, respond) ->
    return unless msg.type == 'oracle'
    store = $.indexedDB('oracle').objectStore('cards', false)
    query = buildQuery msg
    if typeof query == 'number' then store = store.index('multiverseids')
    store.get(query).done (card) ->
        return respond.apply unless card
        $.extend true, card, selectSet(msg, card)
        $.when(findOther(card)).done (card) -> respond.apply null, [ prune(card) ]
    return true

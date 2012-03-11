# intancify template manager
# http://hamalog.tumblr.com/post/13593032409/jquery-tmpldeck

deck = $.TmplDeck 'templates.html'

# ============================================
# jQuery plugins
# ============================================

# just make inside links' target="_blank"

$.fn.linkBlankify = ->
  @each ->
    $(@).find('a').each ->
      $(@).attr 'target', '_blank'

# shake element for notify

$.fn.shake = ->
  @each ->
    n = 30
    $(@).stop()
      .animate({ left: "-6px" }, n).animate({ left: "6px" }, n)
      .animate({ left: "-6px" }, n).animate({ left: "6px" }, n)
      .animate({ left: "0px" }, n)

# ============================================
# utils
# ============================================

# just a setTimeout

wait = (milli) ->
  $.Deferred (defer) ->
    setTimeout ->
      defer.resolve()
    , milli or 0
  .promise()

# twttr.formatDate
# http://awayuki.net/drawer/2011/01/000017.html

twttr.formatDate = (dateString) ->
  d = new Date(dateString)
  year = d.getFullYear()
  if(year != year)
    #if year was NaN, this returns true. IE needs this
    d = new Date(dateString.replace(/^([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+)$/,'$1, $3 $2 $6 $4 $5'));
    year = d.getFullYear()
  month = d.getMonth()+1
  date = d.getDate()
  hour = d.getHours()
  min = d.getMinutes()
  ret = "#{year}/#{month}/#{date} #{hour}:#{min}"

# ============================================
# API wrapper
# ============================================

# namespace

api = {}

# https://dev.twitter.com/docs/api/1/get/search

api.searchTweets = (query) ->
  req = null
  ret = $.Deferred (defer) ->
    req = $.ajax
      url: 'http://search.twitter.com/search.json'
      dataType: 'jsonp'
      data:
        result_type: 'recent'
        rpp: 100
        page: 1
        q: query
    .pipe (res) -> defer.resolve res
    , -> defer.reject()
    .always -> req = null
  .promise()
  ret.abort = ->
    req?.abort()
    ret
  ret

# ============================================
# Abstract things
# ============================================

class Manager
  # tiny item manager
  _.extend @::, Backbone.Events
  add: (item) ->
    @items ?= []
    @items.push item
    @trigger 'sizechange', @size()
  reset: ->
    @items = []
    @
  size: ->
    if @items then @items.length else 0
  remove: (item) ->
    @items = _.without @items, item
    @trigger 'sizechange', @size()
    @

# ============================================
# Model
# ============================================

class Tweet extends Backbone.Model
  # wrap one "Tweet"

class TweetCollection extends Backbone.Collection
  # handles "Tweet"s
  model: Tweet

class TwitterSeach extends Backbone.Model
  # handles twitter search.
  update: ->
    @trigger 'searchstart'
    @updateDefer = (api.searchTweets @get('query'))
    @updateDefer.pipe (res) =>
      @tweets = new TweetCollection res.results
      @trigger 'success'
    , =>
      @trigger 'error'
    .always =>
      @updateDefer = null
    @updateDefer
  destroy: ->
    @updateDefer?.abort()
    super
    @

class TwitterSeachCollection extends Backbone.Collection
  # handles "TwitterSearch"s
  model: TwitterSeach

  # save search queries using localStorage.
  # https://github.com/jeromegn/Backbone.localStorage
  localStorage: new Store 'twittersearch'
  loadCached: ->
    _.each @localStorage.findAll(), (data) =>
      @add data
  updateCache: (twitterSearch) ->
    if @localStorage.find twitterSearch
      @localStorage.update(twitterSearch)
    else
      @localStorage.create(twitterSearch)
    @localStorage.save()
    @

  add: (options) ->
    twitterSearch = (new @model options)
    super(twitterSearch)
    @updateCache(twitterSearch)
    @
  updateAllSearches: ->
    @each (model) -> model.update()
    @

# instancify models

TwitterSearches = new TwitterSeachCollection

# ============================================
# View - tiny thigns
# ============================================

class ListViewSpinner
  # loading spinner
  # http://fgnass.github.com/spin.js/
  constructor: ($parent) ->
    options =
      color: '#fff'
      length: 20
      radius: 30
    spinner = (new Spinner(options)).spin($parent[0])
    @el = spinner.el
    @$el = $(spinner.el)

class WidthChanger extends Backbone.View
  # need to change the container's width
  # according to the count of the searches
  options:
    widthPerItem: 300
  initialize: ->
    @update 1
  update: (size) ->
    @$el.width (@options.widthPerItem * (size + 1))

class NewList extends Backbone.View
  # "add new search" box
  events:
    'click .mod-newlist-btn': 'toggle'
  initialize: ->
    @els =
      content_closed: @$('.mod-newlist-content-closed')
      content_opened: @$('.mod-newlist-content-opened')
  toggle: =>
    @$el.toggleClass 'state-close state-open'

class SearchForm extends Backbone.View
  # serach form in NewList
  events:
    'submit': '_submitHandler'
  initialize: ->
    @els =
      input: @$('input[type=search]')
  _submitHandler: (e) =>
    e.preventDefault()
    val = @els.input.val()
    if not val then return
    @trigger 'submit', val

# ============================================
# View - tweets related things
# ============================================

class TweetView extends Backbone.View
  # represent the view of "Tweet"
  className: 'mod-tweetitem'
  render: ->
    @$el.html( deck.tmpl 'TweetView', @model.toJSON() )
    @

class TweetListView extends Backbone.View
  # represent the view of "TweetCollection"
  className: 'mod-tweetlist'
  events:
    'click .mod-tweetlist-util-reload': 'reload'
    'click .mod-tweetlist-remove': 'remove'
  initialize: ->
    @els = {}
    @manager = new Manager
    @model.bind 'searchstart', => @renderLoading()
    @model.bind 'success', => @renderContent()
    @model.bind 'error', => @renderError()
    @model.update()
  refreshItems: ->
    if @model.tweets.length
      @model.tweets.each (tweet) =>
        view = new TweetView {model: tweet}
        @manager.add view
        @els.bd.append (view.render().el)
    else
      @els.bd.append (deck.draw 'TweetView-noresult')
    @
  renderLoading: ->
    @$el.html( deck.tmpl 'TweetListView-frame', @model.toJSON() )
    @els.bd = @$('.mod-tweetlist-bd')
    wait(0).done => #need to wait a little for spinner positioning
      spinner = new ListViewSpinner @els.bd
      @els.spinner = spinner.$el
    @
  renderContent: ->
    @els.spinner.fadeOut =>
      @els.spinner.remove()
      @refreshItems()
      @els.bd.hide().fadeIn().linkBlankify()
    @
  renderError: ->
    @$el.html( deck.tmpl 'TweetListView-error' )
    @
  reload: =>
    @model.update()
  remove: =>
    @$el.fadeOut 400, 'easeOutExpo', =>
      @model.destroy()
      @manager.reset()
      @$el.remove()
      @trigger 'remove', @
    @

class ListContainerView extends Backbone.View
  # represent the view of "TwitterSeachCollection"
  initialize: ->
    @manager = new Manager
    @els =
      inner: @$('.mod-listcontainer-inner')
      items: @$('.mod-listcontainer-items')
    @widthChanger = new WidthChanger {el: @els.inner}
    @manager.bind 'sizechange', (size) =>
      @widthChanger.update size
    TwitterSearches.bind 'add', @addOne
  addOne: (twitterSearch) =>
    model = twitterSearch
    view = new TweetListView {model: model}
    view.bind 'remove', => @manager.remove view
    @els.items.append view.el
    @manager.add view
    @

# ============================================
# View - AutoReloader
# ============================================

class ReloadTimer
  # timer manager
  _.extend @::, Backbone.Events
  _tickDefer: null
  constructor: (interval) ->
    @interval = @counter = interval
  tick: ->
    currentTick =
      paused: false
      tick: =>
        wait(1000).done =>
          if currentTick.paused then return
          @counter--
          @trigger 'tick', @counter
          if @counter is 0
            @counter = @interval + 1
            @trigger 'hitzero'
          @tick()
      destroy: ->
        currentTick.paused = true
    currentTick.tick()
    @_currentTick = currentTick
    @
  resume: ->
    @_currentTick?.destroy()
    @tick()
    @
  pause: ->
    @_currentTick?.destroy()
    @
  reset: (interval) ->
    if interval then @interval = interval
    @counter = @interval + 1
    @

class AutoReloader extends Backbone.View
  events:
    'focus': 'toInput'
    'blur': 'escInput'
    'keydown': '_keydownHandler'
  initialize: ->
    interval = 360
    @timer = new ReloadTimer interval
    @$el.val interval
    @timer.bind 'tick', (time) => @$el.val time
    @timer.bind 'hitzero', => @trigger 'hitzero'
    @timer.resume()
  toInput: =>
    @_lastVal = @$el.val()
    @$el.addClass 'state-input'
    @timer.pause()
    @
  escInput: =>
    @$el.removeClass 'state-input'
    val = @$el.val()
    if val != @_lastVal
      if /^\d+$/.test(val)
        num = parseInt(val, 10)
        @timer.reset num
      else
        @$el.shake()
        @$el.val @timer.counter
    @timer.resume()
    @
  reset: -> @timer.reset()
  _keydownHandler: (e) =>
    if e.keyCode is 13 # pushing enter key invokes blur
      @$el.trigger 'blur'
    @

# ============================================
# do it do it
# ============================================

deck.load().done ->
  $ ->

    # instancify views
    newlist = new NewList {el: $('#newlist')}
    listcontainer = new ListContainerView {el: $('#listcontainer')}
    searchform = new SearchForm {el: $('#searchform')}
    autoreloader = new AutoReloader {el: $('#autoreloader')}

    # views' events' call model's method
    searchform.bind 'submit', (query) ->
      TwitterSearches.add {query: query}

    autoreloader.bind 'hitzero', ->
      TwitterSearches.updateAllSearches()

    $('#reloadall').click ->
      autoreloader.reset()
      TwitterSearches.updateAllSearches()

    # load the cached search queries
    TwitterSearches.loadCached()


# Template manager
# http://hamalog.tumblr.com/post/13593032409/jquery-tmpldeck
deck = $.TmplDeck 'templates.html'

# ============================================
# plugins
# ============================================

$.fn.linkBlankify = ->
  @each ->
    $(@).find('a').each ->
      $(@).attr 'target', '_blank'

# ============================================
# utils
# ============================================

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
    .pipe (res) ->
      defer.resolve res
    , ->
      defer.reject()
    .always ->
      req = null
  .promise()
  ret.abort = ->
    req?.abort()
    ret
  ret

# ============================================
# Abstract things
# ============================================

class Manager
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
# Models
# ============================================

class Tweet extends Backbone.Model

class TweetCollection extends Backbone.Collection
  model: Tweet
  meta: null

class TwitterSeach extends Backbone.Model
  update: ->
    @trigger 'searchstart'
    @updateDefer = (api.searchTweets @get('query'))
    @updateDefer.pipe (res) =>
      @tweets = new TweetCollection res.results
      #delete res.results
      #@set res
      @trigger 'success'
    , =>
      @trigger 'error'
    @updateDefer
  destroy: ->
    @updateDefer?.abort()
    super
    @

class TwitterSeachCollection extends Backbone.Collection
  model: TwitterSeach
  localStorage: new Store('twittersearch')
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

# define concrete models

window.TwitterSearches = new TwitterSeachCollection

# ============================================
# Views
# ============================================

class ListViewSpinner
  constructor: ($parent) ->
    options =
      color: '#fff'
      length: 20
      radius: 30
    spinner = (new Spinner(options)).spin($parent[0])
    @el = spinner.el
    @$el = $(spinner.el)

class TweetView extends Backbone.View
  className: 'mod-tweetitem'
  render: ->
    @$el.html( deck.tmpl 'TweetView', @model.toJSON() )
    @

class TweetListView extends Backbone.View
  className: 'mod-tweetlist'
  events:
    'click .mod-tweetlist-util-reload': 'reload'
    'click .mod-tweetlist-remove': 'remove'
  initialize: ->
    @els = {}
    @manager = new Manager
  refreshTweets: ->
    @model.tweets.each (tweet) =>
      view = new TweetView {model: tweet}
      @manager.add view
      @els.bd.append (view.render().el)
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
      @refreshTweets()
      @els.bd.hide().fadeIn().linkBlankify()
    @
  renderError: ->
    @$el.html( deck.tmpl 'TweetListView-error' )
    @
  reload: ->
    @model.update()
  remove: ->
    @$el.fadeOut 400, 'easeOutExpo', =>
      @model.destroy()
      @$el.remove()
      @trigger 'remove', @
    @

class WidthChanger extends Backbone.View
  options:
    widthPerItem: 300
  initialize: ->
    @update 1
  update: (size) ->
    @$el.width (@options.widthPerItem * (size + 1))

class ListContainerView extends Backbone.View
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
    @manager.add view
    view.bind 'remove', => @manager.remove view
    model.bind 'searchstart', -> view.renderLoading()
    model.bind 'success', -> view.renderContent()
    model.bind 'error', -> view.renderError()
    model.update()
    @els.items.append view.el
    @

class SearchForm extends Backbone.View
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

class NewList extends Backbone.View
  events:
    'click .mod-newlist-btn': 'toggle'
  initialize: ->
    @els =
      content_closed: @$('.mod-newlist-content-closed')
      content_opened: @$('.mod-newlist-content-opened')
  toggle: =>
    @$el.toggleClass 'state-close state-open'

# ============================================
# do it do it
# ============================================

deck.load().done ->
  $ ->
    newlist = new NewList {el: $('#newlist')}
    listcontainer = new ListContainerView {el: $('#listcontainer')}
    searchform = new SearchForm {el: $('#searchform')}

    searchform.bind 'submit', (query) ->
      TwitterSearches.add {query: query}
    TwitterSearches.loadCached()

    $('#reloadall').click -> TwitterSearches.updateAllSearches()
